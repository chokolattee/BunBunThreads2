const db = require('../config/database'); 

const getShippingOptions = (req, res) => {
  const sql = `SELECT shipping_id, region, rate FROM shipping`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching shipping options:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, data: results });
  });
};

const createOrder = (req, res) => {
  const { customer_id, date_placed, shipping_id, status, items } = req.body;

  if (!customer_id || !date_placed || !shipping_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or invalid order data' });
  }

  db.beginTransaction(err => {
    if (err) {
      console.error('Transaction error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Check stock availability for all items
    let stockCheckComplete = 0;
    let stockErrors = [];
    
    items.forEach(item => {
      const checkStockSql = 'SELECT quantity FROM stock WHERE item_id = ?';
      db.query(checkStockSql, [item.item_id], (err, results) => {
        if (err) {
          stockErrors.push(err);
        } else if (results.length === 0) {
          stockErrors.push(new Error(`Item with ID ${item.item_id} not found in stock`));
        } else if (results[0].quantity < item.quantity) {
          stockErrors.push(new Error(`Insufficient stock for item ${item.item_id}. Available: ${results[0].quantity}, Requested: ${item.quantity}`));
        }
        
        stockCheckComplete++;
        
        // When all stock checks are done
        if (stockCheckComplete === items.length) {
          if (stockErrors.length > 0) {
            return db.rollback(() => {
              console.error('Stock check errors:', stockErrors);
              res.status(400).json({ 
                success: false, 
                message: stockErrors[0].message 
              });
            });
          }
          
          // All items have sufficient stock, proceed with order creation
          const orderInfoSql = `
            INSERT INTO orderinfo (customer_id, date_placed, shipping_id, status)
            VALUES (?, ?, ?, ?)
          `;

          db.query(orderInfoSql, [customer_id, date_placed, shipping_id, status], (err, result) => {
            if (err) {
              return db.rollback(() => {
                console.error('Insert orderinfo error:', err);
                res.status(500).json({ success: false, message: 'Failed to create order' });
              });
            }

            const orderinfo_id = result.insertId;

            // Insert order lines
            const orderlines = items.map(item => [orderinfo_id, item.item_id, item.quantity]);
            const orderlineSql = 'INSERT INTO orderline (orderinfo_id, item_id, quantity) VALUES ?';

            db.query(orderlineSql, [orderlines], (err) => {
              if (err) {
                return db.rollback(() => {
                  console.error('Insert orderline error:', err);
                  res.status(500).json({ success: false, message: 'Failed to add order items' });
                });
              }

              // Update stock quantities
              let stockUpdatesComplete = 0;
              let stockUpdateErrors = [];
              
              items.forEach(item => {
                const updateStockSql = 'UPDATE stock SET quantity = quantity - ? WHERE item_id = ?';
                db.query(updateStockSql, [item.quantity, item.item_id], (err, result) => {
                  if (err) {
                    stockUpdateErrors.push(err);
                  } else if (result.affectedRows === 0) {
                    stockUpdateErrors.push(new Error(`Failed to update stock for item ${item.item_id}`));
                  }
                  
                  stockUpdatesComplete++;
                  
                  // When all stock updates are done
                  if (stockUpdatesComplete === items.length) {
                    if (stockUpdateErrors.length > 0) {
                      return db.rollback(() => {
                        console.error('Stock update errors:', stockUpdateErrors);
                        res.status(500).json({ 
                          success: false, 
                          message: 'Failed to update stock quantities: ' + stockUpdateErrors[0].message 
                        });
                      });
                    }
                    
                    // Commit transaction
                    db.commit(err => {
                      if (err) {
                        return db.rollback(() => {
                          console.error('Commit error:', err);
                          res.status(500).json({ success: false, message: 'Failed to finalize order' });
                        });
                      }

                      res.json({ 
                        success: true, 
                        message: 'Order created and stock updated successfully', 
                        orderinfo_id 
                      });
                    });
                  }
                });
              });
            });
          });
        }
      });
    });
  });
};

const getOrdersByCustomer = (req, res) => {
    const customerId = req.params.customerId;

    // Get orders + shipping info
    const sql = `
      SELECT 
        o.orderinfo_id,
        o.date_placed,
        o.status,
        s.region,
        s.rate
      FROM orderinfo o
      JOIN shipping s ON o.shipping_id = s.shipping_id
      WHERE o.customer_id = ?
      ORDER BY o.date_placed DESC
    `;
  
    db.query(sql, [customerId], (err, orders) => {
      if (err) {
        console.error("Error fetching orders:", err);
        return res.status(500).json({ success: false, message: "Error fetching orders" });
      }
  
      if (!orders.length) {
        return res.json({ success: true, data: [] });
      }
  
      // Get all order lines for these orders
      const orderIds = orders.map(o => o.orderinfo_id);
      const placeholders = orderIds.map(() => '?').join(',');
  
      const itemSql = `
        SELECT 
          ol.orderinfo_id,
          i.item_name,
          i.sell_price AS price,
          ol.quantity
        FROM orderline ol
        JOIN item i ON i.item_id = ol.item_id
        WHERE ol.orderinfo_id IN (${placeholders})
      `;
  
      db.query(itemSql, [...orderIds], (err, orderItems) => {
        if (err) {
          console.error("Error fetching order items:", err);
          return res.status(500).json({ success: false, message: "Error fetching items" });
        }
  
        // Group items by orderinfo_id
        const grouped = {};
        orderItems.forEach(item => {
          if (!grouped[item.orderinfo_id]) grouped[item.orderinfo_id] = [];
          grouped[item.orderinfo_id].push({
            item_name: item.item_name,
            quantity: item.quantity,
            price: item.price
          });
        });
  
        // Attach items to orders
        const final = orders.map(order => ({
          ...order,
          items: grouped[order.orderinfo_id] || []
        }));
  
        res.json({ success: true, data: final });
      });
    });
  };

const getAllOrders = (req, res) => {
    const sql = `
        SELECT o.*, c.fname, c.lname, c.email, s.shipping_rate, s.cost AS shipping_cost
        FROM orderinfo o
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN shipping s ON o.shipping_id = s.shipping_id
        ORDER BY o.date_placed DESC
    `;

    try {
        connection.query(sql, (err, orders) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error fetching orders' });
            }

            return res.status(200).json({
                success: true,
                orders
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};


module.exports = {
  createOrder,
  getOrdersByCustomer,
  getShippingOptions
};

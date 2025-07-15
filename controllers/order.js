const db = require('../config/database'); 
const sendEmail = require('../utils/sendEmail');

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
            VALUES (?, NOW(), ?, ?)
          `;

          db.query(orderInfoSql, [customer_id, shipping_id, status], (err, result) => {
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

                      // ✅ Fetch customer and shipping info
                      const customerDetailsSql = `
                        SELECT u.email, CONCAT(c.fname, ' ', c.lname) AS fullName, s.region, s.rate
                        FROM customer c
                        JOIN users u ON u.id = c.user_id
                        JOIN shipping s ON s.shipping_id = ?
                        WHERE c.customer_id = ?
                      `;

                      db.query(customerDetailsSql, [shipping_id, customer_id], (err, userResult) => {
                        if (err || !userResult.length) {
                          console.error('Email fetch error:', err);
                          return res.json({ success: true, message: 'Order created but customer info not found.', orderinfo_id });
                        }

                        const { email, fullName, region, rate } = userResult[0];

                        // ✅ Now fetch item details
                        const itemDetailsSql = `
                          SELECT i.item_name, i.sell_price AS price, ol.quantity
                          FROM orderline ol
                          JOIN item i ON ol.item_id = i.item_id
                          WHERE ol.orderinfo_id = ?
                        `;

                        db.query(itemDetailsSql, [orderinfo_id], (err, itemRows) => {
                          if (err) {
                            console.error('Item fetch error:', err);
                            return res.json({ success: true, message: 'Order created. Failed to build receipt.', orderinfo_id });
                          }

                          const itemsHtml = itemRows.map(item => `
                            <tr>
                              <td>${item.item_name}</td>
                              <td>${item.quantity}</td>
                              <td>₱${parseFloat(item.price).toFixed(2)}</td>
                              <td>₱${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                            </tr>
                          `).join('');

                          const subtotal = itemRows.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
                          const total = (subtotal + parseFloat(rate)).toFixed(2);

                          const message = `
                            <h3>Hi ${fullName || 'Customer'},</h3>
                            <p>Thank you for placing your order with <strong>BunBun Threads</strong>!</p>
                            <p><strong>Order ID:</strong> ${orderinfo_id}</p>
                            <p><strong>Date Placed:</strong> ${new Date(date_placed).toLocaleDateString()}</p>

                            <h4>Order Summary</h4>
                            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
                              <thead>
                                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
                              </thead>
                              <tbody>${itemsHtml}</tbody>
                            </table>
                            <p><strong>Shipping:</strong> ${region} - ₱${parseFloat(rate).toFixed(2)}</p>
                            <p><strong>Total:</strong> ₱${total}</p>

                            <br><p>We will notify you once your order status is updated.<br></p>
                          `;

                          // Send email (make sure sendEmail is properly imported/defined)
                          sendEmail({
                            email,
                            subject: `BunBun Threads - Order #${orderinfo_id} Confirmation`,
                            message
                          })
                          .then(() => {
                            res.json({ success: true, message: 'Order created and email sent.', orderinfo_id });
                          })
                          .catch(emailErr => {
                            console.error('Email sending failed:', emailErr);
                            res.json({ success: true, message: 'Order created but email failed.', orderinfo_id });
                          });
                        });
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
        SELECT 
            o.orderinfo_id,
            o.customer_id,
            o.date_placed,
            o.date_shipped,
            o.date_delivered,
            o.shipping_id,
            o.status,
            o.deleted_at,
            CONCAT(c.fname, ' ', c.lname) AS customer_name,
            s.region AS shipping_method,
            COUNT(ol.item_id) AS total_items
        FROM orderinfo o
        JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN shipping s ON o.shipping_id = s.shipping_id
        LEFT JOIN orderline ol ON o.orderinfo_id = ol.orderinfo_id
        GROUP BY o.orderinfo_id
        ORDER BY o.date_placed DESC
    `;

    db.query(sql, (err, orders) => {
        if (err) {
            console.error('Database error fetching orders:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Database error fetching orders',
                error: err.message 
            });
        }

        const formattedOrders = orders.map(order => ({
            ...order,
            date_placed: order.date_placed ? new Date(order.date_placed).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : null,
            date_shipped: order.date_shipped ? new Date(order.date_shipped).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : null,
            date_delivered: order.date_delivered ? new Date(order.date_delivered).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : null,
        }));

        return res.status(200).json({
            success: true,
            data: formattedOrders
        });
    });
};

// Get order details by ID
const getOrderById = (req, res) => {
    const orderId = req.params.orderId;

    // Get basic order info
    const orderSql = `
        SELECT 
            o.orderinfo_id,
            o.customer_id,
            o.date_placed,
            o.date_shipped,
            o.date_delivered,
            o.shipping_id,
            o.status,
            o.deleted_at,
            CONCAT(c.fname, ' ', c.lname) AS customer_name,
            s.region AS shipping_method,
            s.rate AS shipping_rate
        FROM orderinfo o
        JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN shipping s ON o.shipping_id = s.shipping_id
        WHERE o.orderinfo_id = ?
    `;

    db.query(orderSql, [orderId], (err, orderResults) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch order details',
                error: err.message 
            });
        }

        if (orderResults.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const order = orderResults[0];

        // Get order items
        const itemsSql = `
            SELECT 
                ol.item_id,
                ol.quantity,
                i.item_name,
                i.sell_price AS unit_price,
                (ol.quantity * i.sell_price) AS total_price
            FROM orderline ol
            JOIN item i ON ol.item_id = i.item_id
            WHERE ol.orderinfo_id = ?
        `;

        db.query(itemsSql, [orderId], (err, itemResults) => {
            if (err) {
                console.error('Error fetching order items:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to fetch order items',
                    error: err.message 
                });
            }

            const subtotal = itemResults.reduce((sum, item) => sum + item.total_price, 0);
            const total = subtotal + (order.shipping_rate || 0);

            const result = {
                ...order,
                items: itemResults,
                subtotal: subtotal,
                total: total,
                total_items: itemResults.length
            };

            res.json({ success: true, data: result });
        });
    });
};

// Update order status
const updateOrderStatus = (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required',
    });
  }

  const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value',
    });
  }

  let updateSql = 'UPDATE orderinfo SET status = ?';
  const params = [status];

  if (status === 'Shipped') {
    updateSql += ', date_shipped = NOW()';
  } else if (status === 'Delivered') {
    updateSql += ', date_delivered = NOW()';
  }

  updateSql += ' WHERE orderinfo_id = ?';
  params.push(orderId);

  db.query(updateSql, params, (err, result) => {
    if (err) {
      console.error('Error updating order status:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // ✅ Step 1: Fetch customer, shipping, and order info
    const customerDetailsSql = `
      SELECT 
        u.email, CONCAT(c.fname, ' ', c.lname) AS fullName, 
        s.region, s.rate, o.date_placed, o.date_shipped, o.date_delivered
      FROM orderinfo o
      JOIN customer c ON o.customer_id = c.customer_id
      JOIN users u ON u.id = c.user_id
      JOIN shipping s ON o.shipping_id = s.shipping_id
      WHERE o.orderinfo_id = ?
    `;

    db.query(customerDetailsSql, [orderId], (err, userResult) => {
      if (err || !userResult.length) {
        console.error('Customer info error:', err);
        return res.json({
          success: true,
          message: 'Order status updated, but customer info not found.',
        });
      }

      const {
        email,
        fullName,
        region,
        rate,
        date_placed,
        date_shipped,
        date_delivered
      } = userResult[0];

      // ✅ Step 2: Fetch item details
      const itemDetailsSql = `
        SELECT i.item_name, i.sell_price AS price, ol.quantity
        FROM orderline ol
        JOIN item i ON ol.item_id = i.item_id
        WHERE ol.orderinfo_id = ?
      `;

      db.query(itemDetailsSql, [orderId], (err, itemRows) => {
        if (err) {
          console.error('Item fetch error:', err);
          return res.json({
            success: true,
            message: 'Order status updated, but failed to fetch item details.',
          });
        }

        const itemsHtml = itemRows.map(item => `
          <tr>
            <td>${item.item_name}</td>
            <td>${item.quantity}</td>
            <td>₱${parseFloat(item.price).toFixed(2)}</td>
            <td>₱${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('');

        const subtotal = itemRows.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
        const total = (subtotal + parseFloat(rate)).toFixed(2);

        const statusMessages = {
          Pending: 'Your order is now marked as <strong>Pending</strong>. We’ll prepare it shortly!',
          Shipped: 'Great news! Your order has been <strong>shipped</strong> and is on its way.',
          Delivered: 'Your order has been <strong>delivered</strong>. We hope you enjoy it!',
          Cancelled: 'We’re sorry. Your order has been <strong>cancelled</strong>. Please contact us if this was a mistake.',
        };

        const formatDateTime = (date) =>
          date ? new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '';

        const message = `
          <h3>Hi ${fullName || 'Customer'},</h3>
          <p>${statusMessages[status]}</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Date Placed:</strong> ${formatDateTime(date_placed)}</p>
          ${date_shipped ? `<p><strong>Date Shipped:</strong> ${formatDateTime(date_shipped)}</p>` : ''}
          ${date_delivered ? `<p><strong>Date Delivered:</strong> ${formatDateTime(date_delivered)}</p>` : ''}

          <h4>Order Summary</h4>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p><strong>Shipping:</strong> ${region} - ₱${parseFloat(rate).toFixed(2)}</p>
          <p><strong>Total:</strong> ₱${total}</p>

          <br><p>Thank you for shopping at <strong>BunBun Threads</strong>!</p>
        `;

        sendEmail({
          email,
          subject: `BunBun Threads - Order #${orderId} Status Update: ${status}`,
          message
        })
          .then(() => {
            res.json({
              success: true,
              message: `Order status updated and email sent to ${email}`,
            });
          })
          .catch(emailErr => {
            console.error('Email sending failed:', emailErr);
            res.json({
              success: true,
              message: 'Order status updated but email failed to send.',
            });
          });
      });
    });
  });
};




const softDeleteOrder = (req, res) => {
  const orderId = req.params.orderId;
  
    const lineSql = `UPDATE orderline SET deleted_at = NOW() WHERE orderinfo_id = ?`;
  const orderSql = `UPDATE orderinfo SET deleted_at = NOW() WHERE orderinfo_id = ?`;


  db.beginTransaction(err => {
    if (err) return res.status(500).json({ error: 'Transaction failed', details: err });

    db.query(orderSql, [orderId], (err) => {
      if (err) return db.rollback(() => res.status(500).json({ error: 'Error soft deleting orderinfo', details: err }));

      db.query(lineSql, [orderId], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ error: 'Error soft deleting orderlines', details: err }));

        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ error: 'Commit failed', details: err }));
          return res.status(200).json({ success: true, message: 'Order and order lines soft deleted' });
        });
      });
    });
  });
};

const restoreOrder = (req, res) => {
  const orderId = req.params.orderId;

    const lineSql = `UPDATE orderline SET deleted_at = NULL WHERE orderinfo_id = ?`;
  const orderSql = `UPDATE orderinfo SET deleted_at = NULL WHERE orderinfo_id = ?`;


  db.beginTransaction(err => {
    if (err) return res.status(500).json({ error: 'Transaction failed', details: err });

    db.query(orderSql, [orderId], (err) => {
      if (err) return db.rollback(() => res.status(500).json({ error: 'Error restoring orderinfo', details: err }));

      db.query(lineSql, [orderId], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ error: 'Error restoring orderlines', details: err }));

        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ error: 'Commit failed', details: err }));
          return res.status(200).json({ success: true, message: 'Order and order lines restored' });
        });
      });
    });
  });
};




module.exports = {
  createOrder,
  getOrdersByCustomer,
  getShippingOptions,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  softDeleteOrder,
  restoreOrder,
  sendEmail
};
const connection = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ----------------- Register -----------------
const registerUser = async (req, res) => {
  const { name, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userSql = 'INSERT INTO users (name, password, email) VALUES (?, ?, ?)';

  try {
    connection.execute(userSql, [name, hashedPassword, email], (err, result) => {
      if (err instanceof Error) {
        console.log(err);
        return res.status(401).json({ error: err });
      }

      return res.status(200).json({ success: true, result });
    });
  } catch (error) {
    console.log(error);
  }
};

// ----------------- Login -----------------
const loginUser = (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT id, name, email, password FROM users WHERE email = ? AND deleted_at IS NULL';

  connection.execute(sql, [email], async (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: 'Error logging in', details: err });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = results[0];
    const safePasswordHash = user.password.replace(/^\$2y\$/, '$2b$');
    const match = await bcrypt.compare(password, safePasswordHash);

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    delete user.password;
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

const updateSql = 'UPDATE users SET token = ? WHERE id = ?';
connection.execute(updateSql, [token, user.id], (updateErr) => {
  if (updateErr) {
    console.log(updateErr);
    return res.status(500).json({ error: 'Failed to save token', details: updateErr });
  }

  return res.status(200).json({ success: "welcome back", user, token });
});
  });
};

// ----------------- Create or Update Profile -----------------
const updateUser = (req, res) => {
  const { title, fname, lname, addressline, town, phone, userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const image = req.file ? req.file.path.replace(/\\/g, "/").replace("public/", "") : null;

  const checkSql = `SELECT customer_id FROM customer WHERE user_id = ?`;
  connection.execute(checkSql, [userId], (checkErr, checkResult) => {
    if (checkErr) {
      console.log("Check customer error:", checkErr);
      return res.status(500).json({ error: checkErr });
    }

    if (checkResult.length > 0) {
      // ✅ Update profile
      let updateSql, updateParams;

      if (image) {
        updateSql = `
          UPDATE customer SET 
            title = ?, 
            fname = ?, 
            lname = ?, 
            addressline = ?, 
            town = ?, 
            phone = ?, 
            image_path = ?
          WHERE user_id = ?`;
        updateParams = [title, fname, lname, addressline, town, phone, image, userId];
      } else {
        updateSql = `
          UPDATE customer SET 
            title = ?, 
            fname = ?, 
            lname = ?, 
            addressline = ?, 
            town = ?, 
            phone = ?
          WHERE user_id = ?`;
        updateParams = [title, fname, lname, addressline, town, phone, userId];
      }

      connection.execute(updateSql, updateParams, (updateErr, updateResult) => {
        if (updateErr instanceof Error) {
          console.log("Update error:", updateErr);
          return res.status(500).json({ error: updateErr });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully.',
          result: updateResult
        });
      });
    } else {
      // 🆕 Insert profile
      const insertSql = `
        INSERT INTO customer 
          (title, fname, lname, addressline, town, phone, image_path, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertParams = [title, fname, lname, addressline, town, phone, image, userId];

      connection.execute(insertSql, insertParams, (insertErr, insertResult) => {
        if (insertErr instanceof Error) {
          console.log("Insert error:", insertErr);
          return res.status(500).json({ error: insertErr });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile created successfully.',
          result: insertResult
        });
      });
    }
  });
};

// ----------------- Deactivate User -----------------
const deactivateUser = (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const sql = 'UPDATE users SET deleted_at = ? WHERE email = ?';
  const timestamp = new Date();

  connection.execute(sql, [timestamp, email], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: 'Error deactivating user', details: err });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      email,
      deleted_at: timestamp
    });
  });
};

// ----------------- Get Customer Profile -----------------
const getCustomerProfile = (req, res) => {
  const userId = req.params.userId;
  const sql = 'SELECT * FROM customer WHERE user_id = ?';

  connection.execute(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: 'No profile found' });

    return res.status(200).json({ success: true, data: results[0] });
  });
};

const updateUserRole = (req, res) => {
    const id = req.params.id;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }

    const sql = `
        UPDATE users
        SET role = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
    `;
    const values = [role, id];

    try {
        connection.execute(sql, values, (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: 'Error updating user role', details: err });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({
                success: true,
                message: 'User role updated successfully'
            });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const updateUserStatus = (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const sql = `
        UPDATE users
        SET status = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
    `;
    const values = [status, id];

    try {
        connection.execute(sql, values, (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: 'Error updating user status', details: err });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({
                success: true,
                message: 'User status updated successfully'
            });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const getAllUsers = (req, res) => {
    const sql = `
        SELECT u.*, c.addressline, c.town, c.phone
        FROM users u
        LEFT JOIN customer c ON u.id = c.user_id
        WHERE u.deleted_at IS NULL
        ORDER BY u.id DESC
    `;

    connection.execute(sql, (err, users) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error fetching users', 
                details: err.message 
            });
        }

        return res.status(200).json({
            success: true,
            rows: users
        });
    });
};

const getSingleUser = (req, res) => {
    const id = req.params.id;
    
    // Validate ID
    if (!id || isNaN(id)) {
        return res.status(400).json({ 
            success: false,
            error: 'Invalid user ID' 
        });
    }

    const sql = `
        SELECT u.*, c.addressline, c.town, c.phone
        FROM users u
        LEFT JOIN customer c ON u.id = c.user_id
        WHERE u.id = ? AND u.deleted_at IS NULL
    `;
    
    const values = [parseInt(id)];

    connection.execute(sql, values, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error fetching user', 
                details: err.message 
            });
        }
        
        if (result.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }
        
        console.log('User fetched successfully:', result[0]);
        return res.status(200).json({ 
            success: true, 
            result: result[0]
        });
    });
};
// const deleteUser = (req, res) => {
//     const id = req.params.id;

//     const sql = `
//         UPDATE users
//         SET deleted_at = NOW()
//         WHERE id = ? AND deleted_at IS NULL
//     `;
//     const values = [id];

//     try {
//         connection.execute(sql, values, (err, result) => {
//             if (err) {
//                 console.log(err);
//                 return res.status(500).json({ error: 'Error deleting user', details: err });
//             }

//             if (result.affectedRows === 0) {
//                 return res.status(404).json({ error: 'User not found' });
//             }

//             return res.status(200).json({
//                 success: true,
//                 message: 'User deleted successfully'
//             });
//         });
//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };


module.exports = { 
  registerUser, 
  loginUser, 
  updateUser, 
  deactivateUser, 
  updateUserRole, 
  updateUserStatus, 
  getCustomerProfile, 
  getAllUsers, 
  getSingleUser 
};
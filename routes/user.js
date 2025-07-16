const express = require('express');
const router = express.Router();
const upload = require('../utils/multer')

const { registerUser, loginUser, updateUser, deactivateUser, getCustomerProfile, 
    updateUserRole, updateUserStatus, getAllUsers, getSingleUser } = require('../controllers/user')

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/update-profile', upload.single('image'), updateUser);
router.post('/deactivate', deactivateUser);
router.get('/customers/:userId', getCustomerProfile);

// ✅ Corrected controller calls
router.get('/users', getAllUsers);
router.get('/users/:id', getSingleUser);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);

module.exports = router;

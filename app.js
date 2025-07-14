const express = require('express');
const cors = require('cors');
const users = require('./routes/user');
const itemRoutes = require('./routes/item');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/category');
const orderRoutes = require('./routes/order');  


require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));       
app.use('/images', express.static('images')); 

app.use('/api/users', users);               
app.use('/api/item', itemRoutes);           
app.use('/api/dashboard', dashboardRoutes); 
app.use('/api/category', categoryRoutes);
app.use('/api/orders', orderRoutes);  


module.exports = app;

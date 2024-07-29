// index.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const webhookRoutes = require('./routes/webhookRoutes'); // Fixed typo
const connectToMongo = require('./db/db');

const port = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: process.env.CLIENT_BASE_URL,
  credentials: true
}));
app.use(bodyParser.json()); // Ensure this is used before your routes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/events', eventRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhook', webhookRoutes);

app.listen(port, () => {
  connectToMongo();
  console.log(`Server is running on port ${port}`);
});

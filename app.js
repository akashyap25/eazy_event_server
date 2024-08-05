const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();
const cookieParser = require('cookie-parser');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const taskRoutes = require('./routes/taskRoutes');
const connectToMongo = require('./db/db');
const cors = require('cors');

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());

// Apply raw bodyParser only to the webhook route
app.post('/api/orders/webhook', bodyParser.raw({ type: 'application/json' }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/events', eventRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tasks', taskRoutes);


app.listen(port, () => {
  connectToMongo();
  console.log(`Server is running on port ${port}`);
});


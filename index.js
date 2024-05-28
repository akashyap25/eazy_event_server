const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const cookieParser = require('cookie-parser');
const app = express();
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const eventRegistrationRoutes = require('./routes/eventRegistrationRoutes');

app.use(cors({
  origin: 'http://localhost:1234',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/", authRoutes);
app.use("/events", eventRoutes);
app.use("/categories", categoryRoutes);
app.use("/eventRegistrations", eventRegistrationRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Create a pool with promise support
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  Promise: require('bluebird') // Use bluebird for promises
});

// Promisify the pool
pool.query = require('bluebird').promisify(pool.query);

module.exports = pool;

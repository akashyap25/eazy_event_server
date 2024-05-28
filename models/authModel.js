const db = require('../db/db');
const bcrypt = require('bcrypt');

class UserSQL {
  static async createUser(user) {
    try {
      // Hash the password before storing it in the database
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const result = await db.query(
        'INSERT INTO users (username, email, password, firstName, lastName, dob, mobileNumber) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          user.username,
          user.email,
          hashedPassword,
          user.firstName,
          user.lastName,
          user.dob,
          user.mobileNumber
        ]
      );
      return result.insertId; // Return the ID of the inserted user
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  static async getUserById(id) {
    try {
      const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      return results;

    } catch (error) {
      throw new Error(`Error getting user by ID: ${error.message}`);
    }
  }

  static async getUserByEmailOrUsername(identifier) {
    try {
      const [results] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
    
      return results;
    } catch (error) {
      throw new Error(`Error getting user by email/username: ${error.message}`);
    }
  }

  static async comparePasswords(password, hashedPassword) {
    try {
      const match = await bcrypt.compare(password, hashedPassword);
      return match;
    } catch (error) {
      throw new Error(`Error comparing passwords: ${error.message}`);
    }
  }
}

module.exports = UserSQL; 

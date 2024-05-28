const db = require('../db/db');
const { sendMail } = require('../emailService');

class EventSQL {

  static async createEvent(event) {
    try {
      const result = await db.query(
        'INSERT INTO events (title, description, location, createdAt, imageUrl, startDate, endDate, price, isFree, url, categoryId, organizerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          event.title,
          event.description,
          event.location,
          event.createdAt,
          event.imageUrl,
          event.startDate,
          event.endDate,
          event.price,
          event.isFree ? 1 : 0,
          event.url,
          event.categoryId,
          event.organizerId
        ]
      );
      return result.insertId; 
    } catch (error) {
      throw new Error(`Error creating event: ${error.message}`);
    }
  }

  static async getEventById(id) {
    try {
      const results = await db.query('SELECT * FROM events WHERE id = ?', [id]);
      return results;
    } catch (error) {
      throw new Error(`Error getting event by ID: ${error.message}`);
    }
  }

  static async getAllEvents() {
    try {
      const results = await db.query('SELECT * FROM events');
      return results;
    } catch (error) {
      throw new Error(`Error getting all events: ${error.message}`);
    }
  }

  static async getEventsByCategory(categoryId) {
    try {
      const results = await db.query('SELECT * FROM events WHERE categoryId = ?', [categoryId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting events by category: ${error.message}`);
    }
  }

  static async getEventsByOrganizer(organizerId) {
    try {
      const results = await db.query('SELECT * FROM events WHERE organizerId = ?', [organizerId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting events by organizer: ${error.message}`);
    }
  }

  static async updateEventById(id, updatedFields) {
    try {
      if (Object.keys(updatedFields).length === 0) {
        throw new Error("No fields to update");
      }
      
      // Build the SET part of the SQL query dynamically
      let setClause = '';
      const values = [];
  
      for (const field in updatedFields) {
        setClause += `${field} = ?, `;
        values.push(updatedFields[field]);
      }
      
      // Remove the trailing comma and space
      setClause = setClause.slice(0, -2);
  
      // Execute the update query
      const result = await db.query(
        `UPDATE events SET ${setClause} WHERE id = ?`,
        [...values, id]
      );
  
      return result.changedRows > 0; // Return true if at least one row was updated
    } catch (error) {
      throw new Error(`Error updating event: ${error.message}`);
    }
  }




  // Task Management Methods   //

  static async createTask(task) {
    try {
      const result = await db.query(
        'INSERT INTO tasks (eventId, userId, title, description) VALUES (?, ?, ?, ?)',
        [
          task.eventId,
          task.userId,
          task.title,
          task.description
        ]
      );
      return result.insertId; 
    } catch (error) {
      throw new Error(`Error creating task: ${error.message}`);
    }
  }

  static async getTasksByEventId(eventId) {
    try {
      const results = await db.query('SELECT * FROM tasks WHERE eventId = ?', [eventId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting tasks by event ID: ${error.message}`);
    }
  }

  static async getTaskById(taskId) {
    try {
      const results = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting task by ID: ${error.message}`);
    }
  };

  static async updateTaskById(taskId, updatedFields) {
    try {
      if (Object.keys(updatedFields).length === 0) {
        throw new Error("No fields to update");
      }
      
      // Build the SET part of the SQL query dynamically
      let setClause = '';
      const values = [];
  
      for (const field in updatedFields) {
        setClause += `${field} = ?, `;
        values.push(updatedFields[field]);
      }
      
      // Remove the trailing comma and space
      setClause = setClause.slice(0, -2);
  
      // Execute the update query
      const result = await db.query(
        `UPDATE tasks SET ${setClause} WHERE id = ?`,
        [...values, taskId]
      );
  
      return result.changedRows > 0; // Return true if at least one row was updated

    } catch (error) {
      throw new Error(`Error updating task: ${error.message}`);
    }
  }

  static async deleteTaskById(taskId) {
    try {
      const result = await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);
      return result.affectedRows > 0; // Return true if a row was deleted
    } catch (error) {
      throw new Error(`Error deleting task: ${error.message}`);
    }
  }

  static async getTasksByUserId(userId) {
    try {
      const query = `
        SELECT 
          tasks.*, 
          events.title AS eventTitle, 
          events.description AS eventDescription, 
          events.location AS eventLocation, 
          events.startDate AS eventStartDate, 
          events.endDate AS eventEndDate
        FROM tasks
        JOIN events ON tasks.eventId = events.id
        WHERE tasks.userId = ?;
      `;
      const results = await db.query(query, [userId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting tasks by user ID: ${error.message}`);
    }
  }
}

module.exports = EventSQL;

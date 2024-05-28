const db = require('../db/db');

class EventRegistrationSQL {
    static async createEventRegistration({eventId, userId, transactionId}) {
        try {
            const registrationDate = new Date().toISOString().slice(0, 19).replace("T", " ");

            const result = await db.query(
                'INSERT INTO eventRegistrations (eventId, userId, registrationDate, transactionId) VALUES (?, ?, ?, ?)',
                [eventId, userId, registrationDate, transactionId]
            );

            return result.insertId;
        } catch (error) {
            throw new Error(`Error creating event registration: ${error.message}`);
        }
    }

    static async getEventRegistrationById(eventId, userId) {
        try {
            const results = await db.query('SELECT * FROM eventRegistrations WHERE eventId = ? AND userId = ?', [eventId, userId]);
            return results[0]; // Assuming only one registration per user for an event
        } catch (error) {
            throw new Error(`Error getting event registration by ID: ${error.message}`);
        }
    }
    

    static async getAllEventRegistrations(eventId) {
        try {
            const results = await db.query('SELECT * FROM eventRegistrations WHERE eventId = ?', [eventId]);
            
            return results;
        } catch (error) {
            throw new Error(`Error getting all event registrations: ${error.message}`);
        }
    }

    static async getEventRegistrationByUserId(userId) {
        try {
            const query = `
                SELECT events.* 
                FROM events 
                INNER JOIN eventRegistrations 
                ON events.id = eventRegistrations.eventId 
                WHERE eventRegistrations.userId = ?;
            `;
            const results = await db.query(query, [userId]);
            return results; 
        } catch (error) {
            throw new Error(`Error getting event registration by ID: ${error.message}`);
        }
    }
    
}



module.exports = EventRegistrationSQL;

const express = require('express');
const {
  createTask,
  getTasksByUser,
  getTasksByEvent,
  updateTask,
  deleteTask
} = require('../controllers/taskController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// All task routes require authentication
router.post('/', authenticateToken, createTask);
router.get('/user/:userId', authenticateToken, getTasksByUser);
router.get('/event/:eventId', authenticateToken, getTasksByEvent);
router.put('/:taskId', authenticateToken, updateTask);
router.delete('/:taskId', authenticateToken, deleteTask);

module.exports = router;

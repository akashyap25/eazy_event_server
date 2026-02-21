
const express = require('express');
const {
  createTask,
  getTasksByUser,
  getTasksByEvent,
  updateTask,
  deleteTask
} = require('../controllers/taskController');

const router = express.Router();

router.post('/', createTask);
router.get('/user/:userId', getTasksByUser);
router.get('/event/:eventId', getTasksByEvent);
router.put('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

module.exports = router;

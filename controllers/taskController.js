
const Task = require('../models/task');
const User = require('../models/user');
const Event = require('../models/event');

// Create a new task
const createTask = async (req, res) => {
  try {
    const { title, description, event, assignee,deadline } = req.body;

    const newTask = await Task.create({ title, description, event: event, assignedTo: assignee,deadline });

    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tasks assigned to a specific user
const getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await Task.find({ assignedTo: userId }).populate('event');

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tasks related to a specific event
const getTasksByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const tasks = await Task.find({ event: eventId }).populate('assignedTo');

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update task status (e.g., mark as completed)
const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completed } = req.body;

    const updatedTask = await Task.findByIdAndUpdate(taskId, { completed }, { new: true });

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    await Task.findByIdAndDelete(taskId);

    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createTask,
  getTasksByUser,
  getTasksByEvent,
  updateTask,
  deleteTask
};

const Task = require('../models/task');
const User = require('../models/user');
const Event = require('../models/event');

// Create a new task
const createTask = async (req, res) => {
  try {
    const { title, description, event, assignedTo, deadline, priority, status, attachments } = req.body;

    const newTask = await Task.create({ 
      title, 
      description, 
      event, 
      assignedTo, 
      deadline, 
      priority,
      status,
      attachments 
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tasks assigned to a specific user
const getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await Task.find({ assignedTo: userId })
      .populate('event')
      .populate('comments.user') // Populate user in comments
      .populate('comments.replies.user'); // Populate user in replies

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTasksByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const tasks = await Task.find({ event: eventId })
      .populate('assignedTo')
      .populate('comments.user')
      .populate('comments.replies.user');

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });

    if (!updatedTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

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
};

// Add a comment to a task
const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;
    const userId = req.user?.id;

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $push: { comments: { user: userId, text } } },
      { new: true }
    ).populate('comments.user').populate('comments.replies.user');

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a reply to a comment
const addReply = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user?.id;

    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, 'comments._id': commentId },
      { 
        $push: { 'comments.$.replies': { user: userId, text } } 
      },
      { new: true }
    ).populate('comments.user').populate('comments.replies.user');

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createTask,
  getTasksByUser,
  getTasksByEvent,
  updateTask,
  deleteTask,
  addComment,
  addReply
};

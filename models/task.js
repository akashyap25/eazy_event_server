
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  deadline: { type: Date }
});

module.exports = mongoose.model('Task', taskSchema);

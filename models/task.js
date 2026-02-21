const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deadline: { type: Date },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'completed', 'overdue'], 
    default: 'pending' 
  },
  attachments: [{ type: String }], // Array of file URLs
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      replies: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          text: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        }
      ], // Nested replies for each comment
    }
  ],
});

// Middleware to update `updatedAt` before saving
taskSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Task', taskSchema);

const { Server } = require('socket.io');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', 
  },
});



// Emit event when a new task is assigned
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  // Emit a taskAssigned event
  socket.emit('taskAssigned', {
    assigneeId: userId, // The ID of the user assigned the task
    task: { ...taskData }, // Task data 
  });

  // Emit an eventCreated event for a category the user is interested in
  socket.emit('eventCreated', {
    userId: userId, // The ID of the user interested in the category
    event: { ...eventData }, // Event data
  });
});


module.exports = { app, server, io };
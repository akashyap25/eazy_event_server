const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  createdAt: { type: Date, default: Date.now },
  imageUrl: { type: String, required: true },
  startDateTime: { type: Date, default: Date.now },
  endDateTime: { type: Date, default: Date.now },
  price: { type: String },
  isFree: { type: Boolean, default: false },
  url: { type: String },
  category: { type: mongoose.Schema.ObjectId, ref: 'Category' },
  organizer: { type: mongoose.Schema.ObjectId, ref: 'User' }, 
})


const Event = mongoose.model('Event', EventSchema);

module.exports = Event;

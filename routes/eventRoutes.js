const {
  createEvent,
  getEvent,
  getAllEvents,
  updateEvent,
  getEventsByOrganizerId,
  createTask,
  getTasksByEventId,
  updateTask,
  deleteTask,
  getTasksByUserId
} = require("../controllers/eventControllers");
const router = require("express").Router();

// Event routes
router.get("/all", getAllEvents); // Retrieve all events
router.get("/:eventId", getEvent); // Get a specific event by ID
router.get("/organizer/:organizerId", getEventsByOrganizerId); // Get events by organizer ID
router.post("/", createEvent); // Create a new event
router.put("/:eventId", updateEvent); // Update an event by ID

// Task routes
router.post("/tasks", createTask); // Create a new task
router.get("/:eventId/tasks", getTasksByEventId); // Get tasks by event ID
router.put("/tasks/:taskId", updateTask); // Update a task by ID
router.delete("/tasks/:taskId", deleteTask); // Delete a task by ID
router.get("/tasks/:userId", getTasksByUserId); // Get tasks by user ID

module.exports = router;

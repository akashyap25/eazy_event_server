const Event = require("../models/eventModel");
const jwt = require("jsonwebtoken");

module.exports.checkEvent = async (req, res, next) => {
  const token = req.cookies.jwt;

  try {
    if (!token) {
      return res.status(401).json({ status: false, message: "No token provided" });
    } else {
      jwt.verify(token, "Anurags_Secret", async (err, decodedToken) => {
        if (err) {
          return res.status(401).json({ status: false, message: "Invalid token" });
        }

        const event = await Event.findById(req.params.eventId); 
        if (!event) {
          return res.status(404).json({ status: false, message: "Event not found" });
        }

        // If token is valid and event is found, continue to the next middleware or route handler
        req.event = event; // Attach event to the request object for later use if needed
        next();
      });
    }
  } catch (error) {
    console.error("Error in event authentication middleware:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

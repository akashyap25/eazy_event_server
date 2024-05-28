const EventRegistration = require("../models/eventRegistrationModel");
const jwt = require("jsonwebtoken");

module.exports.checkEventRegistration = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  try {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: false, message: "No or invalid token provided" });
    }

    const token = authHeader.split(" ")[1]; // Extract token from header

    jwt.verify(token, "Anurags_Secret", async (err, decodedToken) => {
      if (err) {
        return res.status(401).json({ status: false, message: "Invalid token" });
      }

      // Check if the user is registered for the event
    //   const eventRegistration = await EventRegistration.getEventRegistrationById({
    //     eventId: req.body.eventId,
    //     userId: decodedToken.id
    //   });

    //   if (!eventRegistration) {
    //     return res.status(404).json({ status: false, message: "User is not registered for this event" });
    //   }

      // If token is valid and user is registered for the event, continue to the next middleware or route handler
    //   req.eventRegistration = eventRegistration; // Attach event registration to the request object for later use if needed
      next();
    });
  } catch (error) {
    console.error("Error in event registration authentication middleware:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

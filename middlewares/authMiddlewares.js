const UserSQL = require("../models/authModel");
const jwt = require("jsonwebtoken");

module.exports.checkUser = async (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers["x-access-token"] || req.cookies.jwt || (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  
  try {
    if (!token) {
      return res.status(401).json({ status: false, message: "No token provided" });
    }

    jwt.verify(token, "Anurags_Secret", async (err, decodedToken) => {
      if (err) {
        return res.status(401).json({ status: false, message: "Invalid token" });
      } else {
        try {
          const user = await UserSQL.getUserById(decodedToken.id);
          if (user) {
            req.user = user; // Attach user object to the request for later use
            // next(); // Call next middleware function
          } else {
            res.status(404).json({ status: false, message: "User not found" });
          }
        } catch (error) {
          console.error("Error finding user by ID:", error.message);
          res.status(500).json({ status: false, message: "Internal Server Error" });
        }
      }
    });
  } catch (error) {
    console.error("Error in authentication middleware:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

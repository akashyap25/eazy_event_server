const { Webhook } = require('svix'); // Ensure you have the svix package installed
const dotenv = require('dotenv');
const createUser = require('../controllers/userController'); // Ensure the correct path to the userController
dotenv.config();

const webhookController = async (req, res) => {
  try {
    // Get the headers and body
    const headers = req.headers;
    const payload = req.body;

    // Get the Svix headers for verification
    const svix_id = headers["svix-id"];
    const svix_timestamp = headers["svix-timestamp"];
    const svix_signature = headers["svix-signature"];

    // If there are no Svix headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({
        success: false,
        message: "Error occurred -- no Svix headers",
      });
    }

    // Create a new Svix instance with your secret.
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET_KEY);

    let evt;

    // Attempt to verify the incoming webhook
    // If successful, the payload will be available from 'evt'
    // If the verification fails, error out and return error code
    try {
      evt = wh.verify(JSON.stringify(payload), {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.log("Error verifying webhook:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Handle the webhook event
    const { id, ...attributes } = evt.data;
    const eventType = evt.type;

    if (eventType === 'user.created') {
      console.log(`User ${id} was created`);

      // Create the user with the necessary attributes
      const newUser = {
        clerkUserId: id,
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        email: attributes.email,
        userName: attributes.username,
        photo: attributes.photo,
      };

      try {
        await createUser(newUser); // Ensure createUser is properly defined in your controller
        console.log('User created in MongoDB');
      } catch (error) {
        console.error('Error creating user in MongoDB:', error);
        return res.status(500).json({
          success: false,
          message: 'Error creating user in MongoDB',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = webhookController;

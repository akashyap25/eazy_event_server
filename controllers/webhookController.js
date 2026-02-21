const { Webhook } = require('svix'); // Ensure you have the svix package installed
const dotenv = require('dotenv');
const axios = require('axios'); // Import axios
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

    switch (eventType) {
      case 'user.created':
        console.log(`User ${id} was created`);
        
        // Create the user with the necessary attributes
        const newUser = {
          clerkId: id,
          firstName: attributes.first_name,
          lastName: attributes.last_name,
          email: attributes.email_addresses[0].email_address,
          username: attributes.username,
          photo: attributes.image_url,
        };

        console.log('New user:', newUser);

        try {
          // Use axios to send a request to the createUser route
          await axios.post(`${process.env.SERVER_BASE_URL}/api/users/`, newUser); // Ensure SERVER_BASE_URL is set in your .env
          console.log('User created in MongoDB');
        } catch (error) {
          console.error('Error creating user in MongoDB:', error);
          return res.status(500).json({
            success: false,
            message: 'Error creating user in MongoDB',
          });
        }
        break;

      case 'user.updated':
        console.log(`User ${id} was updated`);
        
        // Update the user with the necessary attributes
        const updatedUser = {
          firstName: attributes.first_name,
          lastName: attributes.last_name,
          email: attributes.email_addresses[0].email_address,
          username: attributes.username,
          photo: attributes.image_url,
        };

        console.log('Updated user:', updatedUser);

        try {
          // Use axios to send a request to the updateUser route
          await axios.put(`${process.env.SERVER_BASE_URL}/api/users/${id}`, updatedUser); // Ensure SERVER_BASE_URL is set in your .env
          console.log('User updated in MongoDB');
        } catch (error) {
          console.error('Error updating user in MongoDB:', error);
          return res.status(500).json({
            success: false,
            message: 'Error updating user in MongoDB',
          });
        }
        break;

      case 'user.deleted':
        console.log(`User ${id} was deleted`);

        try {
          // Use axios to send a request to the deleteUser route
          await axios.delete(`${process.env.SERVER_BASE_URL}/api/users/${id}`); // Ensure SERVER_BASE_URL is set in your .env
          console.log('User deleted from MongoDB');
        } catch (error) {
          console.error('Error deleting user from MongoDB:', error);
          return res.status(500).json({
            success: false,
            message: 'Error deleting user from MongoDB',
          });
        }
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
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

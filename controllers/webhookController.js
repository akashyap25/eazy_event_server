const { Webhook } = require('svix'); // Ensure you have the svix package installed
const dotenv = require('dotenv');
const createUser = require('../controllers/userController'); // Ensure the correct path to the userController
dotenv.config();

const webhookController = async (req, res) => {
  try {
    const payloadString = req.body.toString();
    const svixHeaders = req.headers;

    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET_KEY);
    const evt = wh.verify(payloadString, svixHeaders);
    const { id, ...attributes } = evt.data;

    // Handle the webhooks
    const eventType = evt.type;
    if (eventType === 'user.created') {
      console.log(`User ${id} was ${eventType}`);
      console.log(attributes);

      const userAttributes = {
        clerkUserId: id,
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        email: attributes.email,
        userName: attributes.username,
        photo: attributes.photo,
      };

      await createUser(userAttributes); // Call the createUser function from userController
      console.log('User created');
    }

    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = webhookController;


const router = require("express").Router();
const {createEventRegistration,getEventRegistration,getAllEventRegistrations,getEventRegistrationByUserId} = require('../controllers/eventRegistrationControllers');
const { checkEventRegistration } = require("../middlewares/eventRegistrationMiddleware");

router.post('/',checkEventRegistration, createEventRegistration);

router.get('/:eventId/:userId', getEventRegistration);

router.get('/:eventId', getAllEventRegistrations);

router.get("/:userId", getEventRegistrationByUserId);

module.exports = router;

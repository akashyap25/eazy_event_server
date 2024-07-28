const express = require('express');
const { createUser, getUserById, updateUser, deleteUser, getUserByClerkId } = require('../controllers/userController');

const router = express.Router();

router.post('/', createUser);
router.get('/:id', getUserById);
router.get('/clerk/:clerkId', getUserByClerkId);
router.put('/:clerkId', updateUser);
router.delete('/:clerkId', deleteUser);

module.exports = router;

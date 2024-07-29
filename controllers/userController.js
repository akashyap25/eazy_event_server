const User = require('../models/user');
const Event = require('../models/event');
const Order = require('../models/order');

const createUser = async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserByClerkId = async (req, res) => {
  try {
    const { clerkId } = req.params;
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user by Clerk ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { clerkId } = req.params;
    const updatedUser = await User.findOneAndUpdate({ clerkId }, req.body, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User update failed' });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { clerkId } = req.params;
    const userToDelete = await User.findOne({ clerkId });

    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update related events and orders
    await Promise.all([
      Event.updateMany({ _id: { $in: userToDelete.events } }, { $pull: { organizer: userToDelete._id } }),
      Order.updateMany({ _id: { $in: userToDelete.orders } }, { $unset: { buyer: 1 } }),
    ]);

    const deletedUser = await User.findByIdAndDelete(userToDelete._id);

    res.status(200).json(deletedUser ? { success: true, user: deletedUser } : null);
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getUserByClerkId,
};

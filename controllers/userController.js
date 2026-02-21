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

const getCurrentUser = async (req, res) => {
  try {
    // User should already be attached by authenticateToken middleware
    const user = req.user;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    
    // Users can only update their own profile
    if (id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only update your own profile' 
      });
    }

    const { email, username, firstName, lastName, avatar } = req.body;
    
    // Check if email or username is being changed and if it's already taken
    if (email || username) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: existingUser.email === email ? 'Email already in use' : 'Username already taken'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      id, 
      { email, username, firstName, lastName, avatar }, 
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    
    // Users can only delete their own profile
    if (id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own profile' 
      });
    }

    const userToDelete = await User.findById(id);

    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Soft delete - just deactivate the account
    userToDelete.isActive = false;
    await userToDelete.save();

    res.status(200).json({ 
      success: true, 
      message: 'Account deactivated successfully',
      user: userToDelete 
    });
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
  getCurrentUser,
};

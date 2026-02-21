const Category = require('../models/category');

const createCategory = async (req, res) => {
  try {
    const { categoryName, description, imageUrl, isActive } = req.body;
    
    const createdBy = req.user?.id; 


    const newCategory = await Category.create({
      name: categoryName,
      description,
      imageUrl,
      isActive: isActive !== undefined ? isActive : true,
      createdBy
    });

    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {
    // const categories = await Category.find({ isActive: true });
    const categories = await Category.find();
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
};

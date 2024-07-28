const Category = require('../models/category');

const createCategory = async (req, res) => {
  try {

    const { categoryName } = req.body;
    const newCategory = await Category.create({ name: categoryName });

    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {

    const categories = await Category.find();

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
};

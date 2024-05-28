const CategorySQL = require('../models/categoryModel');

const handleErrors = (err) => {
  let errors = {
    name: ''
  };

  if (err.message.includes('Category validation failed')) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

module.exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const newCategory = {
      name
    };

    const categoryId = await CategorySQL.createCategory(newCategory);
    res.status(201).json({ category: categoryId, created: true });
  } catch (err) {
    console.error(err);
    const errors = handleErrors(err);
    res.status(400).json({ errors, created: false });
  }
};

module.exports.getCategory = async (req, res) => {
  const { categoryId } = req.params;
  try {
    const category = await CategorySQL.getCategoryById(categoryId);
    if (category) {
      res.status(200).json({ category });
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports.getAllCategories = async (req, res) => {
  try {
    const categories = await CategorySQL.getAllCategories();
    res.status(200).json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



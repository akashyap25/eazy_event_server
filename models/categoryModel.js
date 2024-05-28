const db = require('../db/db');

class CategorySQL {
  static async createCategory(categoryName) {
    try {
      const result = await db.query(
        'INSERT INTO categories (name) VALUES (?)',
        [categoryName]
      );
      return result.insertId; // Return the ID of the inserted category
    } catch (error) {
      throw new Error(`Error creating category: ${error.message}`);
    }
  }

  static async getCategoryById(categoryId) {
    try {
      const results = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
      return results;
    } catch (error) {
      throw new Error(`Error getting category by Id: ${error.message}`);
    }
  }

  static async getAllCategories() {
    try {module.exports.updateCategory = async (req, res) => {
      const { categoryId } = req.params;
    
      try {
        const updatedFields = {};
        if (req.body.name) {
          updatedFields.name = req.body.name;
        }
    
        const updatedCategory = await CategorySQL.updateCategoryById(categoryId, updatedFields);
        if (updatedCategory) {
          res.status(200).json({ message: 'Category updated successfully' });
        } else {
          res.status(404).json({ message: 'Category not found' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    };
      const results = await db.query('SELECT * FROM categories');
      return results;
    } catch (error) {
      throw new Error(`Error getting all categories: ${error.message}`);
    }
  }
}

module.exports = CategorySQL;

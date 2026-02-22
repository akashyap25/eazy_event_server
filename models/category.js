const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization',
    index: true
  },
  isGlobal: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, { timestamps: true });

// Compound unique index - name unique within organization (or globally if no org)
categorySchema.index({ name: 1, organizationId: 1 }, { unique: true });
categorySchema.index({ isActive: 1, organizationId: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;

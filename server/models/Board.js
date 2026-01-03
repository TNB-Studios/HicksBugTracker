const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Board name is required'],
      trim: true,
      maxlength: [100, 'Board name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    columnOrder: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Column'
    }]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Board', boardSchema);

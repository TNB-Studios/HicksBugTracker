const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Column name is required'],
      trim: true,
      maxlength: [50, 'Column name cannot exceed 50 characters']
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Board ID is required']
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    taskIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    }]
  },
  {
    timestamps: true
  }
);

// Index for faster queries by board
columnSchema.index({ boardId: 1 });

module.exports = mongoose.model('Column', columnSchema);

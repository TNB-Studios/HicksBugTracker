const mongoose = require('mongoose');

const userColumnOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required']
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Board ID is required']
    },
    columnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Column',
      required: [true, 'Column ID is required']
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

// Compound unique index - each user can only have one order per column
userColumnOrderSchema.index({ userId: 1, boardId: 1, columnId: 1 }, { unique: true });

module.exports = mongoose.model('UserColumnOrder', userColumnOrderSchema);

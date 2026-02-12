const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    _id: false
  }
);

const customFieldSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Board ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
      maxlength: [100, 'Field name cannot exceed 100 characters']
    },
    options: {
      type: [optionSchema],
      default: []
    },
    allowUserCreatedOptions: {
      type: Boolean,
      default: false
    },
    appliesTo: {
      type: [String],
      enum: ['Task', 'Bug', 'Suggestion'],
      default: ['Task', 'Bug', 'Suggestion']
    },
    showOnBoard: {
      type: Boolean,
      default: true
    },
    showInList: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: only one field with a given name per board
customFieldSchema.index({ boardId: 1, name: 1 }, { unique: true });

// Index for ordering fields within a board
customFieldSchema.index({ boardId: 1, order: 1 });

module.exports = mongoose.model('CustomField', customFieldSchema);

const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String
    },
    size: {
      type: Number
    }
  },
  {
    _id: false
  }
);

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true
    },
    author: {
      type: String,
      trim: true,
      default: 'Anonymous'
    },
    files: {
      type: [fileSchema],
      default: [],
      validate: [arr => arr.length <= 4, 'Maximum 4 files per comment']
    }
  },
  {
    timestamps: true
  }
);

const taskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: Number,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Task name is required'],
      trim: true,
      maxlength: [200, 'Task name cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true
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
    state: {
      type: String,
      default: 'Backlog'
    },
    assignedTo: {
      type: String,
      trim: true
    },
    reportedBy: {
      type: String,
      trim: true
    },
    comments: [commentSchema],
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    taskType: {
      type: String,
      enum: ['Task', 'Bug', 'Suggestion'],
      default: 'Task'
    },
    dependsOn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    tags: {
      type: [String],
      default: []
    },
    files: {
      type: [fileSchema],
      default: [],
      validate: [arr => arr.length <= 4, 'Maximum 4 files per task']
    },
    customFields: {
      type: Map,
      of: String,
      default: new Map()
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
taskSchema.index({ boardId: 1 });
taskSchema.index({ columnId: 1 });
taskSchema.index({ state: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ taskType: 1 });
taskSchema.index({ dependsOn: 1 });
taskSchema.index({ tags: 1 });
// Text index on name only - description excluded since it now contains HTML
taskSchema.index({ name: 'text' });
// Compound index for task number uniqueness per board
taskSchema.index({ boardId: 1, taskNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Task', taskSchema);

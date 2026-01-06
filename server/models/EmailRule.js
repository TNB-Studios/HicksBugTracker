const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      enum: ['fromState', 'toState', 'priority', 'taskType', 'assignee', 'reporter', 'newAssignee', 'previousAssignee']
    },
    operator: {
      type: String,
      required: true,
      enum: ['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']
    },
    value: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const conditionsSchema = new mongoose.Schema(
  {
    logic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND'
    },
    rules: {
      type: [conditionSchema],
      default: []
    }
  },
  { _id: false }
);

const emailConfigSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      required: true,
      enum: ['assignee', 'reporter', 'specific'],
      default: 'assignee'
    },
    specificUserId: {
      type: Number,
      default: null
    },
    specificEmail: {
      type: String,
      trim: true,
      default: ''
    },
    specificName: {
      type: String,
      trim: true,
      default: ''
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true
    },
    body: {
      type: String,
      required: [true, 'Email body is required'],
      trim: true
    }
  },
  { _id: false }
);

const triggerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['state_change', 'assignee_change', 'comment_added', 'comment_edited']
    }
  },
  { _id: false }
);

const emailRuleSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    trigger: {
      type: triggerSchema,
      required: true
    },
    conditions: {
      type: conditionsSchema,
      default: () => ({ logic: 'AND', rules: [] })
    },
    email: {
      type: emailConfigSchema,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for unique name per board
emailRuleSchema.index({ boardId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('EmailRule', emailRuleSchema);

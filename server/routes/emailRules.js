const express = require('express');
const router = express.Router();
const EmailRule = require('../models/EmailRule');
const Board = require('../models/Board');

// @route   GET /api/boards/:boardId/email-rules
// @desc    Get all email rules for a board
router.get('/boards/:boardId/email-rules', async (req, res, next) => {
  try {
    const { boardId } = req.params;

    // Verify board exists
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const rules = await EmailRule.find({ boardId }).sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/boards/:boardId/email-rules/:id
// @desc    Get a single email rule
router.get('/boards/:boardId/email-rules/:id', async (req, res, next) => {
  try {
    const rule = await EmailRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (rule.boardId.toString() !== req.params.boardId) {
      return res.status(404).json({ success: false, error: 'Rule not found for this board' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards/:boardId/email-rules
// @desc    Create a new email rule
router.post('/boards/:boardId/email-rules', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { name, enabled, trigger, conditions, email } = req.body;

    // Verify board exists
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    // Check for duplicate name
    const existingRule = await EmailRule.findOne({
      boardId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (existingRule) {
      return res.status(400).json({
        success: false,
        error: 'A rule with this name already exists for this board'
      });
    }

    const rule = await EmailRule.create({
      boardId,
      name,
      enabled: enabled !== undefined ? enabled : true,
      trigger,
      conditions: conditions || { logic: 'AND', rules: [] },
      email
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A rule with this name already exists for this board'
      });
    }
    next(error);
  }
});

// @route   PUT /api/boards/:boardId/email-rules/:id
// @desc    Update an email rule
router.put('/boards/:boardId/email-rules/:id', async (req, res, next) => {
  try {
    const { boardId, id } = req.params;
    const { name, enabled, trigger, conditions, email } = req.body;

    const rule = await EmailRule.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (rule.boardId.toString() !== boardId) {
      return res.status(404).json({ success: false, error: 'Rule not found for this board' });
    }

    // Check for duplicate name (excluding current rule)
    if (name && name !== rule.name) {
      const existingRule = await EmailRule.findOne({
        boardId,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingRule) {
        return res.status(400).json({
          success: false,
          error: 'A rule with this name already exists for this board'
        });
      }
    }

    // Update fields
    if (name !== undefined) rule.name = name;
    if (enabled !== undefined) rule.enabled = enabled;
    if (trigger !== undefined) rule.trigger = trigger;
    if (conditions !== undefined) rule.conditions = conditions;
    if (email !== undefined) rule.email = email;

    await rule.save();
    res.json({ success: true, data: rule });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A rule with this name already exists for this board'
      });
    }
    next(error);
  }
});

// @route   DELETE /api/boards/:boardId/email-rules/:id
// @desc    Delete an email rule
router.delete('/boards/:boardId/email-rules/:id', async (req, res, next) => {
  try {
    const { boardId, id } = req.params;

    const rule = await EmailRule.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (rule.boardId.toString() !== boardId) {
      return res.status(404).json({ success: false, error: 'Rule not found for this board' });
    }

    await rule.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards/:boardId/email-rules/:id/duplicate
// @desc    Duplicate an email rule
router.post('/boards/:boardId/email-rules/:id/duplicate', async (req, res, next) => {
  try {
    const { boardId, id } = req.params;

    const originalRule = await EmailRule.findById(id);
    if (!originalRule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (originalRule.boardId.toString() !== boardId) {
      return res.status(404).json({ success: false, error: 'Rule not found for this board' });
    }

    // Generate unique name
    let newName = `${originalRule.name} (Copy)`;
    let counter = 1;
    while (await EmailRule.findOne({ boardId, name: newName })) {
      counter++;
      newName = `${originalRule.name} (Copy ${counter})`;
    }

    const newRule = await EmailRule.create({
      boardId,
      name: newName,
      enabled: originalRule.enabled,
      trigger: originalRule.trigger,
      conditions: originalRule.conditions,
      email: originalRule.email
    });

    res.status(201).json({ success: true, data: newRule });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/boards/:boardId/email-rules/:id/toggle
// @desc    Toggle an email rule's enabled status
router.patch('/boards/:boardId/email-rules/:id/toggle', async (req, res, next) => {
  try {
    const { boardId, id } = req.params;

    const rule = await EmailRule.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (rule.boardId.toString() !== boardId) {
      return res.status(404).json({ success: false, error: 'Rule not found for this board' });
    }

    rule.enabled = !rule.enabled;
    await rule.save();

    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

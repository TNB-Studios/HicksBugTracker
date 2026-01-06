const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const Column = require('../models/Column');
const Task = require('../models/Task');

// Default columns for new boards
const DEFAULT_COLUMNS = ['Backlog', 'Next Up', 'Working On', 'Completed', 'In Testing', 'Passed'];

// @route   GET /api/boards
// @desc    Get all boards
router.get('/', async (req, res, next) => {
  try {
    const boards = await Board.find().sort({ createdAt: -1 });
    res.json({ success: true, data: boards });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/boards/:id
// @desc    Get single board with columns and tasks
router.get('/:id', async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    // Get columns for this board, ordered by columnOrder array
    const columns = await Column.findById({ boardId: board._id });

    // Get all tasks for this board
    const tasks = await Task.find({ boardId: board._id });

    // Order columns according to board.columnOrder
    const orderedColumns = board.columnOrder.map(colId =>
      columns.find(col => col._id.toString() === colId.toString())
    ).filter(Boolean);

    res.json({
      success: true,
      data: {
        board,
        columns: orderedColumns,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards
// @desc    Create new board with default columns
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    // Create the board
    const board = await Board.create({ name, description });

    // Create default columns
    const columnPromises = DEFAULT_COLUMNS.map((colName, index) =>
      Column.create({
        name: colName,
        boardId: board._id,
        isDefault: true,
        taskIds: []
      })
    );

    const columns = await Promise.all(columnPromises);

    // Update board with column order
    board.columnOrder = columns.map(col => col._id);
    await board.save();

    res.status(201).json({
      success: true,
      data: { board, columns }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/boards/:id
// @desc    Update board
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, columnOrder } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (columnOrder !== undefined) updateData.columnOrder = columnOrder;

    const board = await Board.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    res.json({ success: true, data: board });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/boards/:id
// @desc    Delete board and all its columns and tasks
router.delete('/:id', async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    // Delete all tasks for this board
    await Task.deleteMany({ boardId: board._id });

    // Delete all columns for this board
    await Column.deleteMany({ boardId: board._id });

    // Delete the board
    await board.deleteOne();

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

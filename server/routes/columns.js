const express = require('express');
const router = express.Router();
const Column = require('../models/Column');
const Board = require('../models/Board');
const Task = require('../models/Task');

// Default columns that should always exist
const DEFAULT_COLUMNS = ['Backlog', 'Next Up', 'Working On', 'Completed', 'In Testing', 'Passed'];

// Ensure default columns exist for a board, returns updated columns array
async function ensureDefaultColumns(board) {
  let columns = await Column.find({ boardId: board._id });
  let columnsChanged = false;

  // Rename "Current" to "Working On" if it exists
  const currentCol = columns.find(c => c.name === 'Current');
  if (currentCol) {
    currentCol.name = 'Working On';
    await currentCol.save();
    columnsChanged = true;
  }

  // Check which default columns are missing
  const existingNames = columns.map(c => c.name);
  const missingDefaults = DEFAULT_COLUMNS.filter(name => !existingNames.includes(name));

  // Create missing default columns
  for (const name of missingDefaults) {
    const newColumn = await Column.create({
      name,
      boardId: board._id,
      isDefault: true,
      taskIds: []
    });
    board.columnOrder.push(newColumn._id);
    columns.push(newColumn);
    columnsChanged = true;
  }

  if (columnsChanged) {
    await board.save();
  }

  return columns;
}

// @route   GET /api/boards/:boardId/columns
// @desc    Get all columns for a board
router.get('/boards/:boardId/columns', async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.boardId);

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    // Ensure default columns exist (self-healing)
    const columns = await ensureDefaultColumns(board);

    // Order columns according to board.columnOrder
    const orderedColumns = board.columnOrder.map(colId =>
      columns.find(col => col._id.toString() === colId.toString())
    ).filter(Boolean);

    res.json({ success: true, data: orderedColumns });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards/:boardId/columns
// @desc    Create a new column
router.post('/boards/:boardId/columns', async (req, res, next) => {
  try {
    const { name } = req.body;
    const board = await Board.findById(req.params.boardId);

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const column = await Column.create({
      name,
      boardId: board._id,
      isDefault: false,
      taskIds: []
    });

    // Add column to board's columnOrder
    board.columnOrder.push(column._id);
    await board.save();

    res.status(201).json({ success: true, data: column });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/columns/:id
// @desc    Update a column
router.put('/columns/:id', async (req, res, next) => {
  try {
    const { name, taskIds } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (taskIds !== undefined) updateData.taskIds = taskIds;

    const column = await Column.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!column) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }

    res.json({ success: true, data: column });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/columns/:id
// @desc    Delete a column (only non-default columns)
router.delete('/columns/:id', async (req, res, next) => {
  try {
    const column = await Column.findById(req.params.id);

    if (!column) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }

    if (column.isDefault) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default columns'
      });
    }

    // Move tasks from this column to first default column (Backlog)
    const backlogColumn = await Column.findOne({
      boardId: column.boardId,
      name: 'Backlog'
    });

    if (backlogColumn && column.taskIds.length > 0) {
      // Update tasks to point to backlog column
      await Task.updateMany(
        { columnId: column._id },
        { columnId: backlogColumn._id, state: 'Backlog' }
      );

      // Add task IDs to backlog column
      backlogColumn.taskIds.push(...column.taskIds);
      await backlogColumn.save();
    }

    // Remove column from board's columnOrder
    await Board.findByIdAndUpdate(column.boardId, {
      $pull: { columnOrder: column._id }
    });

    // Delete the column
    await column.deleteOne();

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/boards/:boardId/columns/reorder
// @desc    Reorder columns
router.put('/boards/:boardId/columns/reorder', async (req, res, next) => {
  try {
    const { columnOrder } = req.body;

    const board = await Board.findByIdAndUpdate(
      req.params.boardId,
      { columnOrder },
      { new: true }
    );

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    res.json({ success: true, data: board });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

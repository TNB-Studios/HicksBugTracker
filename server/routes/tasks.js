const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Column = require('../models/Column');

// @route   GET /api/boards/:boardId/tasks
// @desc    Get all tasks for a board (with optional filters)
router.get('/boards/:boardId/tasks', async (req, res, next) => {
  try {
    const { state, assignedTo, search, taskType } = req.query;

    // Build query
    const query = { boardId: req.params.boardId };

    // Filter by state (can be comma-separated for multiple states)
    if (state) {
      const states = state.split(',');
      query.state = { $in: states };
    }

    // Filter by task type (can be comma-separated for multiple types)
    if (taskType) {
      const types = taskType.split(',');
      query.taskType = { $in: types };
    }

    // Filter by assigned user
    if (assignedTo) {
      query.assignedTo = { $regex: assignedTo, $options: 'i' };
    }

    // Text search in name and description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
router.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
router.post('/tasks', async (req, res, next) => {
  try {
    const { name, description, boardId, columnId, state, assignedTo, reportedBy, priority, taskType, dependsOn } = req.body;

    // Verify column exists
    const column = await Column.findById(columnId);
    if (!column) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }

    const task = await Task.create({
      name,
      description,
      boardId,
      columnId,
      state: column.name, // State is always derived from column name
      assignedTo,
      reportedBy,
      priority,
      taskType: taskType || 'Task',
      dependsOn: dependsOn || null
    });

    // Add task to column's taskIds
    column.taskIds.push(task._id);
    await column.save();

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const { name, description, state, assignedTo, reportedBy, priority, taskType, dependsOn } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (state !== undefined) updateData.state = state;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (reportedBy !== undefined) updateData.reportedBy = reportedBy;
    if (priority !== undefined) updateData.priority = priority;
    if (taskType !== undefined) updateData.taskType = taskType;
    if (dependsOn !== undefined) updateData.dependsOn = dependsOn || null;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tasks/:id/move
// @desc    Move task to a different column
router.put('/tasks/:id/move', async (req, res, next) => {
  try {
    const { columnId, position } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const newColumn = await Column.findById(columnId);
    if (!newColumn) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }

    const oldColumnId = task.columnId;

    // Remove task from old column
    if (oldColumnId.toString() !== columnId.toString()) {
      await Column.findByIdAndUpdate(oldColumnId, {
        $pull: { taskIds: task._id }
      });
    } else {
      // Same column, just reordering - remove from current position
      newColumn.taskIds = newColumn.taskIds.filter(
        id => id.toString() !== task._id.toString()
      );
    }

    // Add task to new column at specified position
    if (position !== undefined && position >= 0) {
      newColumn.taskIds.splice(position, 0, task._id);
    } else {
      newColumn.taskIds.push(task._id);
    }
    await newColumn.save();

    // Update task's columnId and state
    task.columnId = columnId;
    // State is always derived from column name
    task.state = newColumn.name;
    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Remove task from column's taskIds
    await Column.findByIdAndUpdate(task.columnId, {
      $pull: { taskIds: task._id }
    });

    // Delete the task
    await task.deleteOne();

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add a comment to a task
router.post('/tasks/:id/comments', async (req, res, next) => {
  try {
    const { text, author } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    task.comments.push({ text, author });
    await task.save();

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tasks/:id/comments/:commentId
// @desc    Delete a comment from a task
router.delete('/tasks/:id/comments/:commentId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    task.comments = task.comments.filter(
      comment => comment._id.toString() !== req.params.commentId
    );
    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

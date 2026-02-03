const express = require('express');
const router = express.Router();
const UserColumnOrder = require('../models/UserColumnOrder');

// @route   GET /api/user-column-orders/:boardId
// @desc    Get user's column orders for all columns in a board
router.get('/:boardId', async (req, res, next) => {
  try {
    const userId = req.oidc.user.sub;
    const { boardId } = req.params;

    const orders = await UserColumnOrder.find({
      userId,
      boardId
    });

    // Return as object keyed by columnId for easy lookup
    const ordersMap = {};
    orders.forEach(order => {
      ordersMap[order.columnId.toString()] = order.taskIds.map(id => id.toString());
    });

    res.json({ success: true, data: ordersMap });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/user-column-orders/:boardId/:columnId
// @desc    Save user's task order for a column (upsert)
router.put('/:boardId/:columnId', async (req, res, next) => {
  try {
    const userId = req.oidc.user.sub;
    const { boardId, columnId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ success: false, error: 'taskIds must be an array' });
    }

    const order = await UserColumnOrder.findOneAndUpdate(
      { userId, boardId, columnId },
      { userId, boardId, columnId, taskIds },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const CustomField = require('../models/CustomField');
const Task = require('../models/Task');
const broadcast = require('../services/broadcast');

// Helper to fetch user from Authentik API
async function getAuthentikUser(email) {
  try {
    const response = await fetch(
      `${process.env.AUTHENTIK_API_URL}/api/v3/core/users/?search=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AUTHENTIK_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.find(u => u.email === email) || null;
  } catch (error) {
    console.error('Error fetching Authentik user:', error);
    return null;
  }
}

// Helper to check if user can manage custom fields
const canManageCustomFields = async (req) => {
  const groups = req.oidc?.user?.groups || [];
  const isAdmin = groups.some(g => g.toLowerCase().replace(/\s+/g, '-') === 'hicks-admins');
  if (isAdmin) return true;

  // Check Authentik user attributes
  const authentikUser = await getAuthentikUser(req.oidc?.user?.email);
  return authentikUser?.attributes?.hicks_can_manage_custom_fields || false;
};

// @route   GET /api/boards/:boardId/custom-fields
// @desc    Get all custom fields for a board
router.get('/boards/:boardId/custom-fields', async (req, res, next) => {
  try {
    const customFields = await CustomField.find({ boardId: req.params.boardId })
      .sort({ order: 1, createdAt: 1 });

    res.json({ success: true, data: customFields });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards/:boardId/custom-fields
// @desc    Create a new custom field
router.post('/boards/:boardId/custom-fields', async (req, res, next) => {
  try {
    if (!(await canManageCustomFields(req))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const { name, options, allowUserCreatedOptions, appliesTo, showOnBoard, showInList, order } = req.body;

    // Get the highest order number for this board
    const lastField = await CustomField.findOne({ boardId: req.params.boardId })
      .sort({ order: -1 });
    const newOrder = order !== undefined ? order : (lastField ? lastField.order + 1 : 0);

    const customField = await CustomField.create({
      boardId: req.params.boardId,
      name,
      options: options || [],
      allowUserCreatedOptions: allowUserCreatedOptions || false,
      appliesTo: appliesTo || ['Task', 'Bug', 'Suggestion'],
      showOnBoard: showOnBoard !== undefined ? showOnBoard : true,
      showInList: showInList !== undefined ? showInList : true,
      order: newOrder
    });

    // Broadcast custom field creation to other users
    const userEmail = req.oidc?.user?.email;
    broadcast.broadcastToBoard(req.params.boardId, 'custom_field_created', { customField }, userEmail);

    res.status(201).json({ success: true, data: customField });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'A field with this name already exists for this board' });
    }
    next(error);
  }
});

// @route   PUT /api/boards/:boardId/custom-fields/:id
// @desc    Update a custom field
router.put('/boards/:boardId/custom-fields/:id', async (req, res, next) => {
  try {
    if (!(await canManageCustomFields(req))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const { name, options, allowUserCreatedOptions, appliesTo, showOnBoard, showInList, order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (options !== undefined) updateData.options = options;
    if (allowUserCreatedOptions !== undefined) updateData.allowUserCreatedOptions = allowUserCreatedOptions;
    if (appliesTo !== undefined) updateData.appliesTo = appliesTo;
    if (showOnBoard !== undefined) updateData.showOnBoard = showOnBoard;
    if (showInList !== undefined) updateData.showInList = showInList;
    if (order !== undefined) updateData.order = order;

    const customField = await CustomField.findOneAndUpdate(
      { _id: req.params.id, boardId: req.params.boardId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!customField) {
      return res.status(404).json({ success: false, error: 'Custom field not found' });
    }

    // Broadcast custom field update to other users
    const userEmail = req.oidc?.user?.email;
    broadcast.broadcastToBoard(req.params.boardId, 'custom_field_updated', { customField }, userEmail);

    res.json({ success: true, data: customField });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'A field with this name already exists for this board' });
    }
    next(error);
  }
});

// @route   DELETE /api/boards/:boardId/custom-fields/:id
// @desc    Delete a custom field and clear it from all tasks
router.delete('/boards/:boardId/custom-fields/:id', async (req, res, next) => {
  try {
    if (!(await canManageCustomFields(req))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const customField = await CustomField.findOne({
      _id: req.params.id,
      boardId: req.params.boardId
    });

    if (!customField) {
      return res.status(404).json({ success: false, error: 'Custom field not found' });
    }

    // Remove this field from all tasks in the board
    await Task.updateMany(
      { boardId: req.params.boardId },
      { $unset: { [`customFields.${customField._id}`]: 1 } }
    );

    await customField.deleteOne();

    // Broadcast custom field deletion to other users
    const userEmail = req.oidc?.user?.email;
    broadcast.broadcastToBoard(req.params.boardId, 'custom_field_deleted', {
      customFieldId: req.params.id
    }, userEmail);

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

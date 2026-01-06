const express = require('express');
const router = express.Router();

// Helper to make Authentik API requests
async function authentikFetch(endpoint, options = {}) {
  const apiUrl = process.env.AUTHENTIK_API_URL;
  const apiToken = process.env.AUTHENTIK_API_TOKEN;

  const response = await fetch(`${apiUrl}/api/v3${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentik API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const data = await authentikFetch('/core/users/');

    // Map users to a simpler format with permissions
    const users = data.results.map(user => ({
      id: user.pk,
      username: user.username,
      name: user.name,
      email: user.email,
      isActive: user.is_active,
      groups: user.groups_obj?.map(g => g.name) || [],
      permissions: {
        canAdminBoards: user.attributes?.hicks_can_admin_boards || false,
        canDeleteTasks: user.attributes?.hicks_can_delete_tasks || false,
        canManageEmailRules: user.attributes?.hicks_can_manage_email_rules || false,
        allowedBoards: user.attributes?.hicks_allowed_boards || []
      }
    }));

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// Update user permissions
router.put('/:id/permissions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { canAdminBoards, canDeleteTasks, canManageEmailRules, allowedBoards } = req.body;

    // First get the current user to preserve other attributes
    const user = await authentikFetch(`/core/users/${id}/`);

    // Update attributes - only update fields that were provided
    const updatedAttributes = { ...user.attributes };

    if (canAdminBoards !== undefined) {
      updatedAttributes.hicks_can_admin_boards = canAdminBoards;
    }
    if (canDeleteTasks !== undefined) {
      updatedAttributes.hicks_can_delete_tasks = canDeleteTasks;
    }
    if (canManageEmailRules !== undefined) {
      updatedAttributes.hicks_can_manage_email_rules = canManageEmailRules;
    }
    if (allowedBoards !== undefined) {
      updatedAttributes.hicks_allowed_boards = allowedBoards;
    }

    // Patch the user
    await authentikFetch(`/core/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        attributes: updatedAttributes
      })
    });

    res.json({
      success: true,
      data: {
        id: user.pk,
        permissions: {
          canAdminBoards: updatedAttributes.hicks_can_admin_boards || false,
          canDeleteTasks: updatedAttributes.hicks_can_delete_tasks || false,
          canManageEmailRules: updatedAttributes.hicks_can_manage_email_rules || false,
          allowedBoards: updatedAttributes.hicks_allowed_boards || []
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

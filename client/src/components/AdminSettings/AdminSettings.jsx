import { useState, useEffect } from 'react';
import { userApi } from '../../services/api';

export default function AdminSettings({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userApi.getAll();
      setUsers(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = async (userId, permission, value) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newPermissions = {
      ...user.permissions,
      [permission]: value
    };

    setSaving(prev => ({ ...prev, [userId]: true }));

    try {
      await userApi.updatePermissions(userId, {
        canAdminBoards: newPermissions.canAdminBoards,
        canDeleteTasks: newPermissions.canDeleteTasks
      });

      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, permissions: newPermissions }
          : u
      ));
    } catch (err) {
      setError('Failed to update permissions: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const isUserAdmin = (user) => {
    return user.groups?.some(g => g.toLowerCase().replace(/\s+/g, '-') === 'hicks-admins');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>User Permissions</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="admin-settings-content">
          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Admin</th>
                  <th>Can Admin Boards</th>
                  <th>Can Delete Tasks</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isAdmin = isUserAdmin(user);
                  return (
                    <tr key={user.id}>
                      <td>{user.name || user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        {isAdmin && <span className="admin-badge-small">Admin</span>}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={isAdmin || user.permissions.canAdminBoards}
                          disabled={isAdmin || saving[user.id]}
                          onChange={e => handlePermissionChange(user.id, 'canAdminBoards', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={isAdmin || user.permissions.canDeleteTasks}
                          disabled={isAdmin || saving[user.id]}
                          onChange={e => handlePermissionChange(user.id, 'canDeleteTasks', e.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="admin-settings-note">
            <p><strong>Note:</strong> Users in the "Hicks Admins" group automatically have all permissions.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

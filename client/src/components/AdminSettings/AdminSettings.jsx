import { useState, useEffect } from 'react';
import { userApi, boardApi } from '../../services/api';
import BoardPermissions from './BoardPermissions';
import EmailRulesManager from './EmailRulesManager';
import EmailConfigSection from './EmailConfigSection';

export default function AdminSettings({ user: currentUser, onClose }) {
  const showUserPermissions = currentUser?.isAdmin;
  const [users, setUsers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Only fetch users if admin (for user permissions section)
      if (showUserPermissions) {
        const [usersResponse, boardsResponse] = await Promise.all([
          userApi.getAll(),
          boardApi.getAll()
        ]);
        setUsers(usersResponse.data.data);
        setBoards(boardsResponse.data.data);
      } else {
        // Non-admin only needs boards for email rules
        const boardsResponse = await boardApi.getAll();
        setBoards(boardsResponse.data.data);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBoardPermissionsUpdate = (userId, allowedBoards) => {
    // Update users array
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, permissions: { ...u.permissions, allowedBoards } }
        : u
    ));
    // Also update selectedUser so the modal UI refreshes
    setSelectedUser(prev =>
      prev && prev.id === userId
        ? { ...prev, permissions: { ...prev.permissions, allowedBoards } }
        : prev
    );
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
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="admin-settings-content">
          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {/* User Permissions Section - Admin Only */}
              {showUserPermissions && (
                <div className="settings-section">
                  <h3>User Permissions</h3>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Admin</th>
                        <th>Can Admin Boards</th>
                        <th>Can Delete Tasks</th>
                        <th>Can Manage Email Rules</th>
                        <th>Board Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => {
                        const isAdmin = isUserAdmin(user);
                        const allowedCount = user.permissions.allowedBoards?.length || 0;
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
                            <td>
                              <input
                                type="checkbox"
                                checked={isAdmin || user.permissions.canManageEmailRules}
                                disabled={isAdmin || saving[user.id]}
                                onChange={e => handlePermissionChange(user.id, 'canManageEmailRules', e.target.checked)}
                              />
                            </td>
                            <td>
                              {isAdmin ? (
                                <span className="all-boards-badge">All Boards</span>
                              ) : (
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={() => setSelectedUser(user)}
                                >
                                  {allowedCount} / {boards.length} boards
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="admin-settings-note">
                    <p><strong>Note:</strong> Users in the "Hicks Admins" group automatically have all permissions.</p>
                  </div>
                </div>
              )}

              {/* Email Configuration Section - Admin Only */}
              {showUserPermissions && (
                <div className="settings-section">
                  <h3>Email Configuration</h3>
                  <p className="section-description">
                    Configure Gmail credentials for sending email notifications.
                  </p>
                  <EmailConfigSection />
                </div>
              )}

              {/* Email Notification Rules Section */}
              <div className="settings-section">
                <h3>Email Notification Rules</h3>
                <EmailRulesManager boards={boards} />
              </div>
            </>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="board-permissions-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Board Access: {selectedUser.name || selectedUser.username}</h2>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>&times;</button>
            </div>
            <div className="board-permissions-content">
              <p className="board-permissions-help">Drag boards between columns to allow or disallow access.</p>
              <BoardPermissions
                user={selectedUser}
                boards={boards}
                onUpdate={handleBoardPermissionsUpdate}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

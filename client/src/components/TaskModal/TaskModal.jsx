import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import FileUpload from '../FileUpload/FileUpload';
import UserSelect from '../UserSelect/UserSelect';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TYPES = ['Task', 'Bug', 'Suggestion'];

// Cache key for localStorage
const CACHE_ASSIGNED_TO = 'hicks_lastAssignedTo';

export default function TaskModal({ task: taskProp, onClose }) {
  const {
    columns,
    tasks,
    currentBoard,
    boardUsers,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addComment,
    deleteComment,
    attachFilesToTask,
    removeFileFromTask,
    attachFilesToComment,
    removeFileFromComment,
    user
  } = useApp();
  const canDeleteTasks = user?.permissions?.canDeleteTasks || false;

  // Get live task from context (updates when files/comments change)
  const task = taskProp ? tasks.find(t => t._id === taskProp._id) || taskProp : null;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    columnId: '',
    assignedTo: '',
    reportedBy: '',
    priority: 'Medium',
    taskType: 'Task',
    dependsOn: ''
  });

  // Get available tasks for dependency dropdown (exclude current task)
  const availableDependencies = tasks.filter(t => t._id !== task?._id);

  // Track if form has unsaved changes (only relevant for editing existing tasks)
  const isDirty = useMemo(() => {
    if (!task) return false; // New task - no dirty tracking needed
    return (
      formData.name !== (task.name || '') ||
      formData.description !== (task.description || '') ||
      formData.columnId !== (task.columnId || '') ||
      formData.assignedTo !== (task.assignedTo || '') ||
      formData.priority !== (task.priority || 'Medium') ||
      formData.taskType !== (task.taskType || 'Task') ||
      formData.dependsOn !== (task.dependsOn || '')
    );
  }, [formData, task]);

  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  useEffect(() => {
    if (task) {
      // Editing existing task - use task values
      setFormData({
        name: task.name || '',
        description: task.description || '',
        columnId: task.columnId || '',
        assignedTo: task.assignedTo || '',
        reportedBy: task.reportedBy || '',
        priority: task.priority || 'Medium',
        taskType: task.taskType || 'Task',
        dependsOn: task.dependsOn || ''
      });
    } else if (columns.length > 0) {
      // New task - use cached assignedTo, auto-fill reportedBy with logged-in user
      const cachedAssignedTo = localStorage.getItem(CACHE_ASSIGNED_TO) || '';
      setFormData(prev => ({
        ...prev,
        columnId: columns[0]._id,
        assignedTo: cachedAssignedTo,
        reportedBy: user?.name || user?.email || ''
      }));
    }
  }, [task, columns, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Task name is required');
      return;
    }

    try {
      // Cache assignedTo for next time
      if (formData.assignedTo) {
        localStorage.setItem(CACHE_ASSIGNED_TO, formData.assignedTo);
      }

      if (task) {
        // Update task fields
        await updateTask(task._id, formData);
        // If column changed, move the task (which also updates state)
        if (formData.columnId !== task.columnId) {
          await moveTask(task._id, formData.columnId);
        }
      } else {
        await createTask(formData);
      }
      onClose();
    } catch (err) {
      alert('Error saving task: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(task._id);
        onClose();
      } catch (err) {
        alert('Error deleting task: ' + err.message);
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await addComment(task._id, newComment.trim(), commentAuthor.trim() || 'Anonymous');
      setNewComment('');
      setCommentAuthor('');
    } catch (err) {
      alert('Error adding comment: ' + err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(task._id, commentId);
    } catch (err) {
      alert('Error deleting comment: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // File upload handlers for task
  const handleTaskFilesUploaded = async (uploadedFiles) => {
    if (task) {
      await attachFilesToTask(task._id, uploadedFiles);
    }
  };

  const handleTaskFileRemove = async (fileId) => {
    if (task) {
      await removeFileFromTask(task._id, fileId);
    }
  };

  // File upload handlers for comments
  const handleCommentFilesUploaded = async (commentId, uploadedFiles) => {
    if (task) {
      await attachFilesToComment(task._id, commentId, uploadedFiles);
    }
  };

  const handleCommentFileRemove = async (commentId, fileId) => {
    if (task) {
      await removeFileFromComment(task._id, commentId, fileId);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="columnId">Column / State</label>
              <select
                id="columnId"
                name="columnId"
                value={formData.columnId}
                onChange={handleChange}
              >
                {columns.map(col => (
                  <option key={col._id} value={col._id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                {PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskType">Type</label>
              <select
                id="taskType"
                name="taskType"
                value={formData.taskType}
                onChange={handleChange}
              >
                {TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="assignedTo">Assigned To</label>
              <UserSelect
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                users={boardUsers}
                placeholder="Select or type a name..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="reportedBy">Reported By</label>
              <input
                type="text"
                id="reportedBy"
                name="reportedBy"
                value={formData.reportedBy}
                readOnly
                className="read-only-field"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="dependsOn">Depends On</label>
            <select
              id="dependsOn"
              name="dependsOn"
              value={formData.dependsOn}
              onChange={handleChange}
            >
              <option value="">None</option>
              {availableDependencies.map(t => (
                <option key={t._id} value={t._id}>
                  [{t.taskType}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {task && (
            <div className="task-meta">
              <p>Created: {formatDate(task.createdAt)}</p>
              {task.updatedAt !== task.createdAt && (
                <p>Updated: {formatDate(task.updatedAt)}</p>
              )}
            </div>
          )}

          {task && currentBoard && (
            <div className="form-group">
              <label>Attachments</label>
              <FileUpload
                boardId={currentBoard._id}
                files={task.files || []}
                onUploadComplete={handleTaskFilesUploaded}
                onFilesChange={(newFiles) => {
                  // Find removed files and delete them
                  const currentFileIds = (task.files || []).map(f => f.fileId);
                  const newFileIds = newFiles.map(f => f.fileId);
                  const removedFileIds = currentFileIds.filter(id => !newFileIds.includes(id));
                  removedFileIds.forEach(fileId => handleTaskFileRemove(fileId));
                }}
              />
            </div>
          )}

          <div className="modal-footer">
            {task ? (
              <>
                {canDeleteTasks && (
                  <button type="button" className="btn btn-danger" onClick={handleDelete}>
                    Delete Task
                  </button>
                )}
                <div className="modal-footer-right">
                  {isDirty && (
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="modal-footer-right">
                <button type="submit" className="btn btn-primary">
                  Create Task
                </button>
              </div>
            )}
          </div>
        </form>

        {task && (
          <div className="comments-section">
            <h3>Comments ({task.comments?.length || 0})</h3>

            <div className="comments-list">
              {task.comments?.map(comment => (
                <div key={comment._id} className="comment">
                  <div className="comment-header">
                    <strong>{comment.author}</strong>
                    <span className="comment-date">{formatDate(comment.createdAt)}</span>
                    <button
                      className="comment-delete"
                      onClick={() => handleDeleteComment(comment._id)}
                    >
                      &times;
                    </button>
                  </div>
                  <p>{comment.text}</p>
                  {currentBoard && (
                    <FileUpload
                      boardId={currentBoard._id}
                      files={comment.files || []}
                      onUploadComplete={(uploadedFiles) => handleCommentFilesUploaded(comment._id, uploadedFiles)}
                      onFilesChange={(newFiles) => {
                        const currentFileIds = (comment.files || []).map(f => f.fileId);
                        const newFileIds = newFiles.map(f => f.fileId);
                        const removedFileIds = currentFileIds.filter(id => !newFileIds.includes(id));
                        removedFileIds.forEach(fileId => handleCommentFileRemove(comment._id, fileId));
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="add-comment">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
              />
              <textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddComment}
              >
                Add Comment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

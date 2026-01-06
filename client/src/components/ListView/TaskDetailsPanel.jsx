import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import FileUpload from '../FileUpload/FileUpload';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TYPES = ['Task', 'Bug', 'Suggestion'];

export default function TaskDetailsPanel({ taskId }) {
  const {
    columns,
    tasks,
    currentBoard,
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

  const task = tasks.find(t => t._id === taskId);

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

  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [saving, setSaving] = useState(false);

  // Get available tasks for dependency dropdown (exclude current task)
  const availableDependencies = tasks.filter(t => t._id !== taskId);

  // Track if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!task) return false;
    return (
      formData.name !== (task.name || '') ||
      formData.description !== (task.description || '') ||
      formData.columnId !== (task.columnId || '') ||
      formData.assignedTo !== (task.assignedTo || '') ||
      formData.reportedBy !== (task.reportedBy || '') ||
      formData.priority !== (task.priority || 'Medium') ||
      formData.taskType !== (task.taskType || 'Task') ||
      formData.dependsOn !== (task.dependsOn || '')
    );
  }, [formData, task]);

  useEffect(() => {
    if (task) {
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
    }
  }, [task]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!task || !formData.name.trim()) return;

    setSaving(true);
    try {
      await updateTask(task._id, formData);
      // If column changed, move the task
      if (formData.columnId !== task.columnId) {
        await moveTask(task._id, formData.columnId);
      }
    } catch (err) {
      alert('Error saving task: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(task._id);
      } catch (err) {
        alert('Error deleting task: ' + err.message);
      }
    }
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;

    try {
      await addComment(task._id, newComment.trim(), commentAuthor.trim() || 'Anonymous');
      setNewComment('');
      setCommentAuthor('');
    } catch (err) {
      alert('Error adding comment: ' + err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!task) return;
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

  if (!taskId) {
    return (
      <div className="task-details-empty">
        <p>Select a task to view details</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="task-details-empty">
        <p>Task not found</p>
      </div>
    );
  }

  return (
    <div className="task-details-panel">
      <div className="task-details-header">
        <h3>Task Details</h3>
        {saving && <span className="saving-indicator">Saving...</span>}
      </div>

      <div className="task-details-body">
        <div className="task-details-form">
          <div className="form-group">
            <label htmlFor="detail-name">Name *</label>
            <input
              type="text"
              id="detail-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="detail-description">Description</label>
            <textarea
              id="detail-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="detail-columnId">Column / State</label>
              <select
                id="detail-columnId"
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
              <label htmlFor="detail-priority">Priority</label>
              <select
                id="detail-priority"
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
              <label htmlFor="detail-taskType">Type</label>
              <select
                id="detail-taskType"
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
              <label htmlFor="detail-assignedTo">Assigned To</label>
              <input
                type="text"
                id="detail-assignedTo"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="detail-reportedBy">Reported By</label>
              <input
                type="text"
                id="detail-reportedBy"
                name="reportedBy"
                value={formData.reportedBy}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="detail-dependsOn">Depends On</label>
            <select
              id="detail-dependsOn"
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

          <div className="task-meta">
            <p><strong>Created:</strong> {formatDate(task.createdAt)}</p>
            {task.updatedAt !== task.createdAt && (
              <p><strong>Updated:</strong> {formatDate(task.updatedAt)}</p>
            )}
          </div>

          {currentBoard && (
            <div className="form-group">
              <label>Attachments</label>
              <FileUpload
                boardId={currentBoard._id}
                files={task.files || []}
                onUploadComplete={handleTaskFilesUploaded}
                onFilesChange={(newFiles) => {
                  const currentFileIds = (task.files || []).map(f => f.fileId);
                  const newFileIds = newFiles.map(f => f.fileId);
                  const removedFileIds = currentFileIds.filter(id => !newFileIds.includes(id));
                  removedFileIds.forEach(fileId => handleTaskFileRemove(fileId));
                }}
              />
            </div>
          )}

          <div className="task-details-actions">
            {canDeleteTasks && (
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete Task
              </button>
            )}
            <div className="task-details-actions-right">
              {isDirty && (
                <button className="btn btn-primary" onClick={handleSave}>
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="task-details-comments">
          <h4>Comments ({task.comments?.length || 0})</h4>

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
            {(!task.comments || task.comments.length === 0) && (
              <p className="no-comments">No comments yet</p>
            )}
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
              rows={3}
            />
            <button
              className="btn btn-primary"
              onClick={handleAddComment}
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

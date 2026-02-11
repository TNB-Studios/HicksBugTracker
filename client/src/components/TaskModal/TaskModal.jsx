import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import FileUpload from '../FileUpload/FileUpload';
import UserSelect from '../UserSelect/UserSelect';
import RichTextEditor from '../RichTextEditor/RichTextEditor';
import RichTextDisplay from '../RichTextDisplay/RichTextDisplay';
import TagSelect from '../TagSelect/TagSelect';

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
    editComment,
    attachFilesToTask,
    removeFileFromTask,
    attachFilesToComment,
    removeFileFromComment,
    user
  } = useApp();
  const canDeleteTasks = user?.permissions?.canDeleteTasks || false;
  const isAdmin = user?.isAdmin || false;

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
    dependsOn: '',
    tags: ''
  });

  // Get available tasks for dependency dropdown (exclude current task)
  const availableDependencies = tasks.filter(t => t._id !== task?._id);

  // Collect all unique tags from existing tasks
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => (task.tags || []).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Track if form has unsaved changes (only relevant for editing existing tasks)
  const isDirty = useMemo(() => {
    if (!task) return false; // New task - no dirty tracking needed
    const taskTags = (task.tags || []).join(', ');
    return (
      formData.name !== (task.name || '') ||
      formData.description !== (task.description || '') ||
      formData.columnId !== (task.columnId || '') ||
      formData.assignedTo !== (task.assignedTo || '') ||
      formData.priority !== (task.priority || 'Medium') ||
      formData.taskType !== (task.taskType || 'Task') ||
      formData.dependsOn !== (task.dependsOn || '') ||
      formData.tags !== taskTags
    );
  }, [formData, task]);

  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]); // Files for new task before creation
  const [pendingCommentFiles, setPendingCommentFiles] = useState([]); // Files for new comment before creation
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

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
        dependsOn: task.dependsOn || '',
        tags: (task.tags || []).join(', ')
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

    console.time('Total Save (Modal)');
    try {
      // Cache assignedTo for next time
      if (formData.assignedTo) {
        localStorage.setItem(CACHE_ASSIGNED_TO, formData.assignedTo);
      }

      // Convert tags string to array
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const dataToSave = {
        ...formData,
        tags: tagsArray
      };

      if (task) {
        // Update task fields
        console.time('API updateTask (Modal)');
        await updateTask(task._id, dataToSave);
        console.timeEnd('API updateTask (Modal)');
        // If column changed, move the task (which also updates state)
        if (formData.columnId !== task.columnId) {
          console.time('API moveTask (Modal)');
          await moveTask(task._id, formData.columnId);
          console.timeEnd('API moveTask (Modal)');
        }
      } else {
        console.time('API createTask (Modal)');
        const newTask = await createTask(dataToSave);
        console.timeEnd('API createTask (Modal)');

        // Attach any pending files to the newly created task
        if (pendingFiles.length > 0) {
          console.time('API attachFilesToTask (Modal)');
          await attachFilesToTask(newTask._id, pendingFiles);
          console.timeEnd('API attachFilesToTask (Modal)');
        }
      }
      onClose();
    } catch (err) {
      alert('Error saving task: ' + err.message);
    } finally {
      console.timeEnd('Total Save (Modal)');
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
      const updatedTask = await addComment(task._id, newComment.trim(), user?.name || user?.email || 'Anonymous');

      // If there are pending files, attach them to the newly created comment
      if (pendingCommentFiles.length > 0 && updatedTask.comments?.length > 0) {
        // The new comment is the last one in the array
        const newCommentObj = updatedTask.comments[updatedTask.comments.length - 1];
        await attachFilesToComment(task._id, newCommentObj._id, pendingCommentFiles);
        setPendingCommentFiles([]);
      }

      setNewComment('');
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

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.text);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async () => {
    if (!editingCommentText.trim()) return;
    try {
      await editComment(task._id, editingCommentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      alert('Error editing comment: ' + err.message);
    }
  };

  // Check if user can edit/delete a comment
  const canModifyComment = (comment) => {
    if (isAdmin) return true;
    const userName = user?.name || user?.email;
    return comment.author === userName;
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
          <h2>
            {task
              ? `${task.taskType || 'Task'}${task.taskNumber ? ` #${task.taskNumber}` : ''}`
              : 'New Task'}
          </h2>
          <div className="modal-header-right">
            {task ? (
              isDirty && (
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                  Save Changes
                </button>
              )
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                Create Task
              </button>
            )}
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
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
            <RichTextEditor
              value={formData.description}
              onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
              placeholder="Enter description..."
            />
          </div>

          {currentBoard && (
            <div className="form-group">
              <label>Attachments</label>
              <FileUpload
                boardId={currentBoard._id}
                files={task ? (task.files || []) : pendingFiles}
                onUploadComplete={task ? handleTaskFilesUploaded : (uploadedFiles) => {
                  setPendingFiles(prev => [...prev, ...uploadedFiles]);
                }}
                onFilesChange={(newFiles) => {
                  if (task) {
                    // Find removed files and delete them
                    const currentFileIds = (task.files || []).map(f => f.fileId);
                    const newFileIds = newFiles.map(f => f.fileId);
                    const removedFileIds = currentFileIds.filter(id => !newFileIds.includes(id));
                    removedFileIds.forEach(fileId => handleTaskFileRemove(fileId));
                  } else {
                    // For new tasks, just update the pending files list
                    setPendingFiles(newFiles);
                  }
                }}
              />
            </div>
          )}

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

          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <TagSelect
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              allTags={allTags}
              placeholder="Enter tags separated by commas (e.g., frontend, urgent, v2.0)"
            />
          </div>

          {task && (
            <div className="task-meta">
              <span>Created: {formatDate(task.createdAt)}</span>
              {task.updatedAt !== task.createdAt && (
                <span className="task-meta-right">Updated: {formatDate(task.updatedAt)}</span>
              )}
            </div>
          )}

        </form>

        {task && (
          <div className="comments-section">
            <h3>Comments ({task.comments?.length || 0})</h3>

            <div className="add-comment">
              <RichTextEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="Add a comment..."
              />
              {currentBoard && (
                <FileUpload
                  boardId={currentBoard._id}
                  files={pendingCommentFiles}
                  onUploadComplete={(uploadedFiles) => {
                    setPendingCommentFiles(prev => [...prev, ...uploadedFiles]);
                  }}
                  onFilesChange={(newFiles) => {
                    setPendingCommentFiles(newFiles);
                  }}
                />
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddComment}
              >
                Add Comment
              </button>
            </div>

            <div className="comments-list">
              {task.comments?.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(comment => (
                <div key={comment._id} className="comment">
                  <div className="comment-header">
                    <strong>{comment.author}</strong>
                    {boardUsers.find(u => u.name === comment.author)?.email && (
                      <span className="comment-email">({boardUsers.find(u => u.name === comment.author).email})</span>
                    )}
                    <span className="comment-date">{formatDate(comment.createdAt)}</span>
                    {canModifyComment(comment) && editingCommentId !== comment._id && (
                      <button
                        className="comment-edit"
                        onClick={() => handleStartEditComment(comment)}
                        title="Edit comment"
                      >
                        &#9998;
                      </button>
                    )}
                    {canModifyComment(comment) && (
                      <button
                        className="comment-delete"
                        onClick={() => handleDeleteComment(comment._id)}
                        title="Delete comment"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {editingCommentId === comment._id ? (
                    <div className="comment-edit-area">
                      <RichTextEditor
                        value={editingCommentText}
                        onChange={setEditingCommentText}
                        placeholder="Edit comment..."
                      />
                      <div className="comment-edit-buttons">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveEditComment}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleCancelEditComment}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <RichTextDisplay content={comment.text} />
                  )}
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
                      disabled={!canModifyComment(comment)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {task && (canDeleteTasks || isDirty) && (
          <div className="modal-footer">
            {canDeleteTasks && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete Task
              </button>
            )}
            <div className="modal-footer-spacer"></div>
            {isDirty && (
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                Save Changes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

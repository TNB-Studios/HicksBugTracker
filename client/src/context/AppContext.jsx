import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { boardApi, columnApi, taskApi, fileApi, emailRuleApi } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children, user }) {
  const [boards, setBoards] = useState([]);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [boardUsers, setBoardUsers] = useState([]);
  const [emailRules, setEmailRules] = useState([]);
  const [pendingEmailNotification, setPendingEmailNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    state: [],
    taskType: [],
    assignedTo: '',
    search: ''
  });

  // Fetch all boards (filtered by user permissions)
  const fetchBoards = useCallback(async () => {
    try {
      const response = await boardApi.getAll();
      let boardList = response.data.data;

      // Filter boards based on user permissions (admins see all)
      if (!user.isAdmin) {
        const allowedBoards = user.permissions?.allowedBoards || [];
        boardList = boardList.filter(b => allowedBoards.includes(b._id));
      }

      setBoards(boardList);
      return boardList;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [user]);

  // Fetch single board with columns and tasks
  const fetchBoard = useCallback(async (boardId) => {
    if (!boardId) return;

    setLoading(true);
    try {
      const [columnsRes, tasksRes] = await Promise.all([
        columnApi.getAll(boardId),
        taskApi.getAll(boardId)
      ]);

      setColumns(columnsRes.data.data);
      setTasks(tasksRes.data.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch users who have access to the current board
  const fetchBoardUsers = useCallback(async (boardId) => {
    if (!boardId) return [];
    try {
      const response = await boardApi.getUsers(boardId);
      const users = response.data.data;
      setBoardUsers(users);
      return users;
    } catch (err) {
      console.error('Error fetching board users:', err.message);
      return [];
    }
  }, []);

  // Fetch email rules for the current board
  const fetchEmailRules = useCallback(async (boardId) => {
    if (!boardId) return [];
    try {
      const response = await emailRuleApi.getAll(boardId);
      const rules = response.data.data || [];
      setEmailRules(rules);
      return rules;
    } catch (err) {
      console.error('Error fetching email rules:', err.message);
      return [];
    }
  }, []);

  // Evaluate a condition against task data
  const evaluateCondition = useCallback((condition, taskData) => {
    const { field, operator, value } = condition;
    let fieldValue = '';

    switch (field) {
      case 'fromState':
        fieldValue = taskData.previousState || '';
        break;
      case 'toState':
        fieldValue = taskData.newState || '';
        break;
      case 'priority':
        fieldValue = taskData.task?.priority || '';
        break;
      case 'taskType':
        fieldValue = taskData.task?.taskType || '';
        break;
      case 'assignee':
        fieldValue = taskData.task?.assignedTo || '';
        break;
      case 'reporter':
        fieldValue = taskData.task?.reportedBy || '';
        break;
      case 'newAssignee':
        fieldValue = taskData.newAssignee || '';
        break;
      case 'previousAssignee':
        fieldValue = taskData.previousAssignee || '';
        break;
      default:
        fieldValue = '';
    }

    switch (operator) {
      case 'equals':
        return fieldValue.toLowerCase() === value.toLowerCase();
      case 'not_equals':
        return fieldValue.toLowerCase() !== value.toLowerCase();
      case 'contains':
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      case 'is_empty':
        return !fieldValue || fieldValue.trim() === '';
      case 'is_not_empty':
        return fieldValue && fieldValue.trim() !== '';
      default:
        return false;
    }
  }, []);

  // Check if a rule matches the given trigger and task data
  const evaluateRule = useCallback((rule, triggerType, taskData) => {
    // Check trigger type matches
    if (rule.trigger.type !== triggerType) return false;

    // Check if rule is enabled
    if (!rule.enabled) return false;

    // Evaluate conditions
    const { conditions } = rule;
    if (!conditions.rules || conditions.rules.length === 0) {
      return true; // No conditions = always match
    }

    if (conditions.logic === 'AND') {
      return conditions.rules.every(cond => evaluateCondition(cond, taskData));
    } else {
      return conditions.rules.some(cond => evaluateCondition(cond, taskData));
    }
  }, [evaluateCondition]);

  // Process template variables in email content
  const processEmailTemplate = useCallback((template, taskData, board) => {
    if (!template) return '';

    const task = taskData.task;
    return template
      .replace(/\{\{task\.name\}\}/g, task?.name || '')
      .replace(/\{\{task\.description\}\}/g, task?.description || '')
      .replace(/\{\{task\.state\}\}/g, taskData.newState || task?.state || '')
      .replace(/\{\{task\.priority\}\}/g, task?.priority || '')
      .replace(/\{\{task\.type\}\}/g, task?.taskType || '')
      .replace(/\{\{task\.assignee\}\}/g, task?.assignedTo || '')
      .replace(/\{\{task\.reporter\}\}/g, task?.reportedBy || '')
      .replace(/\{\{task\.url\}\}/g, window.location.origin + '/?task=' + task?._id)
      .replace(/\{\{previous\.state\}\}/g, taskData.previousState || '')
      .replace(/\{\{previous\.assignee\}\}/g, taskData.previousAssignee || '')
      .replace(/\{\{comment\.text\}\}/g, taskData.commentText || '')
      .replace(/\{\{comment\.author\}\}/g, taskData.commentAuthor || '')
      .replace(/\{\{board\.name\}\}/g, board?.name || '');
  }, []);

  // Get recipient email based on rule configuration
  const getRecipientEmail = useCallback((rule, task) => {
    switch (rule.email.recipientType) {
      case 'assignee':
        // Find user email from boardUsers
        const assignee = boardUsers.find(u => u.name === task?.assignedTo);
        return { name: task?.assignedTo || 'Unknown', email: assignee?.email || 'unknown@example.com' };
      case 'reporter':
        const reporter = boardUsers.find(u => u.name === task?.reportedBy);
        return { name: task?.reportedBy || 'Unknown', email: reporter?.email || 'unknown@example.com' };
      case 'specific':
        return { name: rule.email.specificName, email: rule.email.specificEmail };
      default:
        return { name: 'Unknown', email: 'unknown@example.com' };
    }
  }, [boardUsers]);

  // Evaluate all rules for a trigger and show notification if any match
  const checkEmailRules = useCallback((triggerType, taskData) => {
    const matchingRules = emailRules.filter(rule => evaluateRule(rule, triggerType, taskData));

    if (matchingRules.length > 0) {
      // Process the first matching rule (could extend to handle multiple)
      const rule = matchingRules[0];
      const recipient = getRecipientEmail(rule, taskData.task);
      const subject = processEmailTemplate(rule.email.subject, taskData, currentBoard);
      const body = processEmailTemplate(rule.email.body, taskData, currentBoard);

      setPendingEmailNotification({
        ruleName: rule.name,
        recipient,
        subject,
        body,
        allMatchingRules: matchingRules.length
      });
    }
  }, [emailRules, evaluateRule, getRecipientEmail, processEmailTemplate, currentBoard]);

  // Dismiss email notification preview
  const dismissEmailNotification = useCallback(() => {
    setPendingEmailNotification(null);
  }, []);

  // Load boards on mount
  useEffect(() => {
    const init = async () => {
      const boardList = await fetchBoards();
      if (boardList.length > 0) {
        setCurrentBoard(boardList[0]);
      }
      setLoading(false);
    };
    init();
  }, [fetchBoards]);

  // Fetch board data when current board changes
  // Use currentBoard._id as dependency to ensure effect runs on board switch
  const currentBoardId = currentBoard?._id;
  useEffect(() => {
    if (currentBoardId) {
      fetchBoard(currentBoardId);
      fetchBoardUsers(currentBoardId);
      fetchEmailRules(currentBoardId);
    }
  }, [currentBoardId, fetchBoard, fetchBoardUsers, fetchEmailRules]);

  // Board operations
  const createBoard = async (name, description) => {
    try {
      const response = await boardApi.create({ name, description });
      const newBoard = response.data.data.board;
      setBoards(prev => [newBoard, ...prev]);
      setCurrentBoard(newBoard);
      return newBoard;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateBoard = async (id, data) => {
    try {
      const response = await boardApi.update(id, data);
      const updatedBoard = response.data.data;
      setBoards(prev => prev.map(b => b._id === id ? updatedBoard : b));
      if (currentBoard?._id === id) {
        setCurrentBoard(updatedBoard);
      }
      return updatedBoard;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteBoard = async (id) => {
    try {
      await boardApi.delete(id);
      setBoards(prev => prev.filter(b => b._id !== id));
      if (currentBoard?._id === id) {
        const remaining = boards.filter(b => b._id !== id);
        setCurrentBoard(remaining[0] || null);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Column operations
  const createColumn = async (name) => {
    if (!currentBoard) return;
    try {
      const response = await columnApi.create(currentBoard._id, { name });
      const newColumn = response.data.data;
      setColumns(prev => [...prev, newColumn]);
      return newColumn;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateColumn = async (id, data) => {
    try {
      const response = await columnApi.update(id, data);
      const updatedColumn = response.data.data;
      setColumns(prev => prev.map(c => c._id === id ? updatedColumn : c));
      return updatedColumn;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteColumn = async (id) => {
    try {
      await columnApi.delete(id);
      setColumns(prev => prev.filter(c => c._id !== id));
      // Refresh tasks as they may have been moved to Backlog
      if (currentBoard) {
        const tasksRes = await taskApi.getAll(currentBoard._id);
        setTasks(tasksRes.data.data);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const reorderColumns = async (newOrder) => {
    if (!currentBoard) return;
    try {
      // Optimistic update
      const reorderedColumns = newOrder.map(id => columns.find(c => c._id === id)).filter(Boolean);
      setColumns(reorderedColumns);

      await columnApi.reorder(currentBoard._id, newOrder);
    } catch (err) {
      setError(err.message);
      // Revert on error
      fetchBoard(currentBoard._id);
      throw err;
    }
  };

  // Task operations
  const createTask = async (taskData) => {
    try {
      const response = await taskApi.create({
        ...taskData,
        boardId: currentBoard._id
      });
      const newTask = response.data.data;
      setTasks(prev => [newTask, ...prev]);

      // Update column's taskIds
      setColumns(prev => prev.map(col => {
        if (col._id === newTask.columnId) {
          return { ...col, taskIds: [...col.taskIds, newTask._id] };
        }
        return col;
      }));

      return newTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateTask = async (id, data) => {
    try {
      // Get current task to detect changes
      const currentTask = tasks.find(t => t._id === id);
      const previousAssignee = currentTask?.assignedTo || '';

      const response = await taskApi.update(id, data);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === id ? updatedTask : t));

      // Check for assignee change
      const newAssignee = updatedTask.assignedTo || '';
      if (previousAssignee !== newAssignee) {
        checkEmailRules('assignee_change', {
          task: updatedTask,
          previousAssignee,
          newAssignee
        });
      }

      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const moveTask = async (taskId, newColumnId, position) => {
    try {
      // Ensure consistent string IDs for comparisons
      const taskIdStr = String(taskId);
      const newColumnIdStr = String(newColumnId);

      const task = tasks.find(t => String(t._id) === taskIdStr);
      if (!task) return;

      const oldColumnIdStr = String(task.columnId);

      // Get column names for email rule evaluation
      const oldColumn = columns.find(c => String(c._id) === oldColumnIdStr);
      const newColumn = columns.find(c => String(c._id) === newColumnIdStr);
      const previousState = oldColumn?.name || '';
      const newState = newColumn?.name || '';

      // Optimistic update
      setTasks(prev => prev.map(t =>
        String(t._id) === taskIdStr ? { ...t, columnId: newColumnIdStr } : t
      ));

      setColumns(prev => prev.map(col => {
        const colIdStr = String(col._id);
        if (colIdStr === oldColumnIdStr) {
          return { ...col, taskIds: col.taskIds.filter(id => String(id) !== taskIdStr) };
        }
        if (colIdStr === newColumnIdStr) {
          const newTaskIds = [...col.taskIds];
          if (position !== undefined) {
            newTaskIds.splice(position, 0, taskIdStr);
          } else {
            newTaskIds.push(taskIdStr);
          }
          return { ...col, taskIds: newTaskIds };
        }
        return col;
      }));

      const response = await taskApi.move(taskIdStr, newColumnIdStr, position);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => String(t._id) === taskIdStr ? updatedTask : t));

      // Check email rules for state change (only if column actually changed)
      if (oldColumnIdStr !== newColumnIdStr) {
        checkEmailRules('state_change', {
          task: updatedTask,
          previousState,
          newState
        });
      }

      return updatedTask;
    } catch (err) {
      setError(err.message);
      // Revert on error
      fetchBoard(currentBoard._id);
      throw err;
    }
  };

  const deleteTask = async (id) => {
    try {
      const task = tasks.find(t => t._id === id);
      await taskApi.delete(id);
      setTasks(prev => prev.filter(t => t._id !== id));

      // Update column's taskIds
      if (task) {
        setColumns(prev => prev.map(col => {
          if (col._id === task.columnId) {
            return { ...col, taskIds: col.taskIds.filter(tid => tid !== id) };
          }
          return col;
        }));
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const addComment = async (taskId, text, author) => {
    try {
      const response = await taskApi.addComment(taskId, { text, author });
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));

      // Check email rules for comment added
      checkEmailRules('comment_added', {
        task: updatedTask,
        commentText: text,
        commentAuthor: author
      });

      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteComment = async (taskId, commentId) => {
    try {
      const response = await taskApi.deleteComment(taskId, commentId);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // File operations
  const attachFilesToTask = async (taskId, files) => {
    try {
      const response = await fileApi.attachToTask(taskId, files);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeFileFromTask = async (taskId, fileId) => {
    try {
      const response = await fileApi.removeFromTask(taskId, fileId);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const attachFilesToComment = async (taskId, commentId, files) => {
    try {
      const response = await fileApi.attachToComment(taskId, commentId, files);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeFileFromComment = async (taskId, commentId, fileId) => {
    try {
      const response = await fileApi.removeFromComment(taskId, commentId, fileId);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sort tasks by dependency (parent tasks come before their dependents)
  const sortTasksByDependency = useCallback((tasksToSort) => {
    // Build a map of task ID to task for quick lookup
    const taskMap = new Map(tasksToSort.map(t => [t._id, t]));

    // Calculate depth for each task (how many levels of dependencies above it)
    const getDepth = (task, visited = new Set()) => {
      if (!task.dependsOn) return 0;
      if (visited.has(task._id)) return 0; // Prevent circular dependencies
      visited.add(task._id);

      const parent = taskMap.get(task.dependsOn);
      if (!parent) return 0;

      return 1 + getDepth(parent, visited);
    };

    // Create array with depths
    const tasksWithDepth = tasksToSort.map(task => ({
      task,
      depth: getDepth(task)
    }));

    // Sort by depth (lower depth = parent, comes first)
    tasksWithDepth.sort((a, b) => a.depth - b.depth);

    return tasksWithDepth.map(item => item.task);
  }, []);

  // Filter tasks
  const getFilteredTasks = useCallback(() => {
    const filtered = tasks.filter(task => {
      // State filter
      if (filters.state.length > 0 && !filters.state.includes(task.state)) {
        return false;
      }

      // Task type filter
      if (filters.taskType.length > 0 && !filters.taskType.includes(task.taskType || 'Task')) {
        return false;
      }

      // Assigned to filter
      if (filters.assignedTo && !task.assignedTo?.toLowerCase().includes(filters.assignedTo.toLowerCase())) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = task.name?.toLowerCase().includes(searchLower);
        const descMatch = task.description?.toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });

    // Sort by dependency order
    return sortTasksByDependency(filtered);
  }, [tasks, filters, sortTasksByDependency]);

  const value = {
    // State
    boards,
    currentBoard,
    columns,
    tasks,
    boardUsers,
    loading,
    error,
    filters,
    user,
    pendingEmailNotification,

    // Setters
    setCurrentBoard,
    setFilters,
    setError,
    dismissEmailNotification,

    // Board operations
    fetchBoards,
    fetchBoardUsers,
    createBoard,
    updateBoard,
    deleteBoard,

    // Column operations
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,

    // Task operations
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addComment,
    deleteComment,
    getFilteredTasks,

    // File operations
    attachFilesToTask,
    removeFileFromTask,
    attachFilesToComment,
    removeFileFromComment
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

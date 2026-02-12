import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { boardApi, columnApi, taskApi, fileApi, userColumnOrderApi, customFieldApi } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children, user }) {
  const [boards, setBoards] = useState([]);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [boardUsers, setBoardUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clipboard for copy/cut/paste (supports multiple tasks)
  const [clipboard, setClipboard] = useState(null); // { tasks: [], isCut, sourceBoardId }
  const [selectedTaskIds, setSelectedTaskIds] = useState([]); // For clipboard operations (multi-select)

  // User-specific task order per column: { [columnId]: [taskId, ...] }
  const [userTaskOrder, setUserTaskOrder] = useState({});

  // Custom fields for the current board
  const [customFields, setCustomFields] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    state: [],
    taskType: [],
    assignedTo: '',
    search: '',
    tags: []
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

  // Fetch user's column orders for a board
  const fetchUserColumnOrders = useCallback(async (boardId) => {
    if (!boardId) return {};
    try {
      const response = await userColumnOrderApi.getForBoard(boardId);
      const orders = response.data.data;
      setUserTaskOrder(orders);
      return orders;
    } catch (err) {
      console.error('Error fetching user column orders:', err.message);
      return {};
    }
  }, []);

  // Fetch custom fields for a board
  const fetchCustomFields = useCallback(async (boardId) => {
    if (!boardId) return [];
    try {
      const response = await customFieldApi.getAll(boardId);
      const fields = response.data.data || [];
      setCustomFields(fields);
      return fields;
    } catch (err) {
      console.error('Error fetching custom fields:', err.message);
      setCustomFields([]);
      return [];
    }
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
      fetchUserColumnOrders(currentBoardId);
      fetchCustomFields(currentBoardId);
    }
  }, [currentBoardId, fetchBoard, fetchBoardUsers, fetchUserColumnOrders, fetchCustomFields]);

  // Server-Sent Events for real-time updates
  useEffect(() => {
    if (!currentBoardId) return;

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const eventSource = new EventSource(`${apiBase}/events?boardId=${currentBoardId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
          case 'heartbeat':
            // Ignore connection and heartbeat events
            break;

          case 'task_created': {
            const { task, column } = data.data;
            setTasks(prev => {
              // Don't add if already exists
              if (prev.some(t => t._id === task._id)) return prev;
              return [task, ...prev];
            });
            if (column) {
              setColumns(prev => prev.map(c =>
                c._id === column._id ? column : c
              ));
            }
            break;
          }

          case 'task_updated': {
            const { task } = data.data;
            setTasks(prev => prev.map(t => t._id === task._id ? task : t));
            break;
          }

          case 'task_moved': {
            const { task, oldColumnId, newColumnId } = data.data;
            setTasks(prev => prev.map(t => t._id === task._id ? task : t));
            // Update columns' taskIds
            setColumns(prev => prev.map(col => {
              if (col._id === oldColumnId) {
                return { ...col, taskIds: col.taskIds.filter(id => String(id) !== String(task._id)) };
              }
              if (col._id === newColumnId) {
                // Add to end if not already present
                if (!col.taskIds.some(id => String(id) === String(task._id))) {
                  return { ...col, taskIds: [...col.taskIds, task._id] };
                }
              }
              return col;
            }));
            break;
          }

          case 'task_deleted': {
            const { taskId } = data.data;
            setTasks(prev => prev.filter(t => t._id !== taskId));
            // Remove from columns
            setColumns(prev => prev.map(col => ({
              ...col,
              taskIds: col.taskIds.filter(id => String(id) !== String(taskId))
            })));
            break;
          }

          case 'column_created': {
            const { column, columnOrder } = data.data;
            setColumns(prev => {
              // Don't add if already exists
              if (prev.some(c => c._id === column._id)) return prev;
              // Add in correct order
              if (columnOrder) {
                const orderedColumns = columnOrder.map(colId =>
                  colId === column._id ? column : prev.find(c => c._id === colId)
                ).filter(Boolean);
                return orderedColumns;
              }
              return [...prev, column];
            });
            break;
          }

          case 'column_updated': {
            const { column } = data.data;
            setColumns(prev => prev.map(c => c._id === column._id ? column : c));
            break;
          }

          case 'column_deleted': {
            const { columnId, movedTasksToBacklog } = data.data;
            setColumns(prev => prev.filter(c => c._id !== columnId));
            // If tasks were moved, refresh them
            if (movedTasksToBacklog && currentBoardId) {
              taskApi.getAll(currentBoardId).then(res => {
                setTasks(res.data.data);
              }).catch(err => console.error('Error refreshing tasks:', err));
            }
            break;
          }

          case 'columns_reordered': {
            const { columnOrder } = data.data;
            setColumns(prev => {
              const reordered = columnOrder.map(colId =>
                prev.find(c => c._id === colId)
              ).filter(Boolean);
              return reordered;
            });
            break;
          }

          case 'board_created': {
            const { board } = data.data;
            setBoards(prev => {
              // Don't add if already exists
              if (prev.some(b => b._id === board._id)) return prev;
              return [board, ...prev];
            });
            break;
          }

          case 'board_updated': {
            const { board } = data.data;
            setBoards(prev => prev.map(b => b._id === board._id ? board : b));
            // Update currentBoard if it's the same
            setCurrentBoard(prev => prev?._id === board._id ? board : prev);
            break;
          }

          case 'board_deleted': {
            const { boardId } = data.data;
            setBoards(prev => {
              const updated = prev.filter(b => b._id !== boardId);
              // If current board was deleted, switch to first remaining board
              if (currentBoardId === boardId && updated.length > 0) {
                setCurrentBoard(updated[0]);
              } else if (currentBoardId === boardId) {
                setCurrentBoard(null);
              }
              return updated;
            });
            break;
          }

          case 'custom_field_created': {
            const { customField } = data.data;
            setCustomFields(prev => {
              // Don't add if already exists
              if (prev.some(f => f._id === customField._id)) return prev;
              return [...prev, customField].sort((a, b) => a.order - b.order);
            });
            break;
          }

          case 'custom_field_updated': {
            const { customField } = data.data;
            setCustomFields(prev =>
              prev.map(f => f._id === customField._id ? customField : f)
                .sort((a, b) => a.order - b.order)
            );
            break;
          }

          case 'custom_field_deleted': {
            const { customFieldId } = data.data;
            setCustomFields(prev => prev.filter(f => f._id !== customFieldId));
            break;
          }

          default:
            console.log('Unknown SSE event type:', data.type);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // EventSource will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [currentBoardId]);

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
      console.time('updateTask API call');
      const response = await taskApi.update(id, data);
      console.timeEnd('updateTask API call');
      const updatedTask = response.data.data;
      console.time('updateTask setTasks');
      setTasks(prev => prev.map(t => t._id === id ? updatedTask : t));
      console.timeEnd('updateTask setTasks');
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

      // Optimistic update
      setTasks(prev => prev.map(t =>
        String(t._id) === taskIdStr ? { ...t, columnId: newColumnIdStr } : t
      ));

      setColumns(prev => prev.map(col => {
        const colIdStr = String(col._id);

        // Same column reordering
        if (colIdStr === oldColumnIdStr && colIdStr === newColumnIdStr) {
          const newTaskIds = col.taskIds.filter(id => String(id) !== taskIdStr);
          if (position !== undefined) {
            newTaskIds.splice(position, 0, taskIdStr);
          } else {
            newTaskIds.push(taskIdStr);
          }
          return { ...col, taskIds: newTaskIds };
        }

        // Remove from old column
        if (colIdStr === oldColumnIdStr) {
          return { ...col, taskIds: col.taskIds.filter(id => String(id) !== taskIdStr) };
        }

        // Add to new column
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

  const editComment = async (taskId, commentId, text) => {
    try {
      const response = await taskApi.editComment(taskId, commentId, { text });
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

  // Selection operations - always store IDs as strings for consistent comparison
  const selectTask = useCallback((taskId, addToSelection = false) => {
    const idStr = String(taskId);
    if (addToSelection) {
      setSelectedTaskIds(prev =>
        prev.includes(idStr) ? prev : [...prev, idStr]
      );
    } else {
      setSelectedTaskIds([idStr]);
    }
  }, []);

  const toggleTaskSelection = useCallback((taskId) => {
    const idStr = String(taskId);
    setSelectedTaskIds(prev =>
      prev.includes(idStr)
        ? prev.filter(id => id !== idStr)
        : [...prev, idStr]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const selectMultipleTasks = useCallback((taskIds) => {
    setSelectedTaskIds(taskIds.map(id => String(id)));
  }, []);

  // Clipboard operations (now supports multiple tasks)
  const copyTasks = useCallback((tasksToClip) => {
    if (!tasksToClip || tasksToClip.length === 0 || !currentBoard) return;
    setClipboard({
      tasks: tasksToClip.map(t => ({ ...t })),
      isCut: false,
      sourceBoardId: currentBoard._id
    });
  }, [currentBoard]);

  const cutTasks = useCallback((tasksToClip) => {
    if (!tasksToClip || tasksToClip.length === 0 || !currentBoard) return;
    setClipboard({
      tasks: tasksToClip.map(t => ({ ...t })),
      isCut: true,
      sourceBoardId: currentBoard._id
    });
  }, [currentBoard]);

  const generatePasteName = useCallback((baseName, existingTasks) => {
    // Check if name already has a (N) suffix and extract base name
    const suffixMatch = baseName.match(/^(.+?)\s*\((\d+)\)$/);
    const cleanBaseName = suffixMatch ? suffixMatch[1].trim() : baseName;

    // Find all tasks with the same base name (with or without suffix)
    const pattern = new RegExp(`^${cleanBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*\\(\\d+\\))?$`);
    const matchingTasks = existingTasks.filter(t => pattern.test(t.name));

    if (matchingTasks.length === 0) {
      return baseName;
    }

    // Find the highest number used
    let maxNum = 0;
    matchingTasks.forEach(t => {
      const match = t.name.match(/\((\d+)\)$/);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });

    // If original name exists without suffix, start from (2)
    const exactMatch = existingTasks.some(t => t.name === cleanBaseName);
    if (exactMatch && maxNum === 0) {
      maxNum = 1;
    }

    return `${cleanBaseName} (${maxNum + 1})`;
  }, []);

  const pasteTasks = useCallback(async (targetColumnId) => {
    if (!clipboard || !currentBoard) return [];

    const { tasks: sourceTasks, isCut, sourceBoardId } = clipboard;
    const results = [];

    try {
      for (const sourceTask of sourceTasks) {
        // For cut operations on the same board, just move the task
        if (isCut && sourceBoardId === currentBoard._id) {
          const result = await moveTask(sourceTask._id, targetColumnId);
          results.push(result);
          continue;
        }

        // For copy or cross-board cut, create a new task
        const existingTasks = tasks;
        const newName = isCut ? sourceTask.name : generatePasteName(sourceTask.name, existingTasks);

        const newTaskData = {
          name: newName,
          description: sourceTask.description || '',
          columnId: targetColumnId,
          assignedTo: sourceTask.assignedTo || '',
          reportedBy: sourceTask.reportedBy || '',
          priority: sourceTask.priority || 'Medium',
          taskType: sourceTask.taskType || 'Task',
          dependsOn: '' // Don't copy dependencies across boards
        };

        const newTask = await createTask(newTaskData);
        results.push(newTask);

        // If it was a cut operation, delete the original (only if on a different board)
        if (isCut && sourceBoardId !== currentBoard._id) {
          try {
            await taskApi.delete(sourceTask._id);
          } catch (err) {
            console.error('Failed to delete original task after cut:', err);
          }
        }
      }

      // Clear clipboard after cut
      if (isCut) {
        setClipboard(null);
      }

      return results;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [clipboard, currentBoard, tasks, moveTask, createTask, generatePasteName]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

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

  // Save user's column order for a specific column
  const setUserColumnOrder = useCallback(async (columnId, taskIds) => {
    if (!currentBoard) return;
    const colIdStr = String(columnId);
    const taskIdStrs = taskIds.map(id => String(id));

    // Optimistic update
    setUserTaskOrder(prev => ({
      ...prev,
      [colIdStr]: taskIdStrs
    }));

    // Persist to database
    try {
      await userColumnOrderApi.save(currentBoard._id, columnId, taskIds);
    } catch (err) {
      console.error('Error saving user column order:', err.message);
    }
  }, [currentBoard]);

  // Sort column tasks by a specific field
  const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  const sortColumnTasks = useCallback((columnId, sortBy, sortDir) => {
    const colIdStr = String(columnId);

    // Get tasks in this column
    const columnTasks = tasks.filter(t => String(t.columnId) === colIdStr);

    // Sort them
    const sortedTasks = [...columnTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          break;
        case 'assignedTo':
          cmp = (a.assignedTo || '').localeCompare(b.assignedTo || '');
          break;
        case 'reportedBy':
          cmp = (a.reportedBy || '').localeCompare(b.reportedBy || '');
          break;
        case 'taskType':
          cmp = (a.taskType || '').localeCompare(b.taskType || '');
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'tags':
          // Sort by first tag alphabetically
          const aTag = (a.tags || [])[0] || '';
          const bTag = (b.tags || [])[0] || '';
          cmp = aTag.localeCompare(bTag);
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    // Save the new order
    const sortedIds = sortedTasks.map(t => t._id);
    setUserColumnOrder(columnId, sortedIds);
  }, [tasks, setUserColumnOrder]);

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

      // Tags filter (task must have at least one of the selected tags)
      if (filters.tags.length > 0) {
        const taskTags = task.tags || [];
        const hasMatchingTag = filters.tags.some(tag => taskTags.includes(tag));
        if (!hasMatchingTag) {
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
    clipboard,
    selectedTaskIds,
    userTaskOrder,
    customFields,

    // Setters
    setCurrentBoard,
    setFilters,
    setError,

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
    editComment,
    getFilteredTasks,

    // File operations
    attachFilesToTask,
    removeFileFromTask,
    attachFilesToComment,
    removeFileFromComment,

    // Selection operations
    selectTask,
    toggleTaskSelection,
    clearSelection,
    selectMultipleTasks,

    // Clipboard operations
    copyTasks,
    cutTasks,
    pasteTasks,
    clearClipboard,

    // User column order operations
    setUserColumnOrder,
    sortColumnTasks,

    // Custom field operations
    fetchCustomFields
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

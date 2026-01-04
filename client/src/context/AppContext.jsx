import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { boardApi, columnApi, taskApi } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children, user }) {
  const [boards, setBoards] = useState([]);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    state: [],
    taskType: [],
    assignedTo: '',
    search: ''
  });

  // Fetch all boards
  const fetchBoards = useCallback(async () => {
    try {
      const response = await boardApi.getAll();
      setBoards(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

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
  useEffect(() => {
    if (currentBoard) {
      fetchBoard(currentBoard._id);
    }
  }, [currentBoard, fetchBoard]);

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
      const response = await taskApi.update(id, data);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === id ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const moveTask = async (taskId, newColumnId, position) => {
    try {
      const task = tasks.find(t => t._id === taskId);
      if (!task) return;

      const oldColumnId = task.columnId;

      // Optimistic update
      setTasks(prev => prev.map(t =>
        t._id === taskId ? { ...t, columnId: newColumnId } : t
      ));

      setColumns(prev => prev.map(col => {
        if (col._id === oldColumnId) {
          return { ...col, taskIds: col.taskIds.filter(id => id !== taskId) };
        }
        if (col._id === newColumnId) {
          const newTaskIds = [...col.taskIds];
          if (position !== undefined) {
            newTaskIds.splice(position, 0, taskId);
          } else {
            newTaskIds.push(taskId);
          }
          return { ...col, taskIds: newTaskIds };
        }
        return col;
      }));

      const response = await taskApi.move(taskId, newColumnId, position);
      const updatedTask = response.data.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));

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
    loading,
    error,
    filters,
    user,

    // Setters
    setCurrentBoard,
    setFilters,
    setError,

    // Board operations
    fetchBoards,
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
    getFilteredTasks
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

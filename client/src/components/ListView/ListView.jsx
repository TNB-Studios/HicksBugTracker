import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import TaskList from './TaskList';
import TaskModal from '../TaskModal/TaskModal';
import './ListView.css';

export default function ListView({ triggerNewTask }) {
  const { currentBoard, loading, tasks, selectedTaskIds, selectTask, toggleTaskSelection, selectMultipleTasks, getFilteredTasks } = useApp();
  const [editingTask, setEditingTask] = useState(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [anchorTaskId, setAnchorTaskId] = useState(null); // For Shift+click range selection
  const prevTriggerNewTask = useRef(triggerNewTask);

  // Open new task modal when triggered from header
  useEffect(() => {
    if (triggerNewTask > 0 && triggerNewTask !== prevTriggerNewTask.current) {
      setShowNewTaskModal(true);
    }
    prevTriggerNewTask.current = triggerNewTask;
  }, [triggerNewTask]);

  const handleTaskClick = useCallback((taskId, e) => {
    const filteredTasks = getFilteredTasks();

    // Shift+click for range selection
    if (e.shiftKey && anchorTaskId) {
      const anchorIndex = filteredTasks.findIndex(t => String(t._id) === String(anchorTaskId));
      const clickedIndex = filteredTasks.findIndex(t => String(t._id) === String(taskId));

      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const startIndex = Math.min(anchorIndex, clickedIndex);
        const endIndex = Math.max(anchorIndex, clickedIndex);
        const tasksInRange = filteredTasks.slice(startIndex, endIndex + 1);
        selectMultipleTasks(tasksInRange.map(t => t._id));
        return;
      }
      // Anchor not found - just select clicked task
      selectTask(taskId);
      setAnchorTaskId(taskId);
    }
    // Ctrl/Cmd+click to toggle selection
    else if (e.ctrlKey || e.metaKey) {
      toggleTaskSelection(taskId);
      if (selectedTaskIds.length === 0) {
        setAnchorTaskId(taskId);
      }
    }
    // Regular click - select single task and set as anchor
    else {
      selectTask(taskId);
      setAnchorTaskId(taskId);
    }
  }, [selectTask, toggleTaskSelection, selectMultipleTasks, getFilteredTasks, anchorTaskId, selectedTaskIds.length]);

  const handleTaskDoubleClick = useCallback((taskId) => {
    const task = tasks.find(t => t._id === taskId);
    if (task) {
      setEditingTask(task);
    }
  }, [tasks]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentBoard) {
    return (
      <div className="no-board">
        <h2>No board selected</h2>
        <p>Create a new board to get started</p>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-view-content">
        <TaskList
          selectedTaskIds={selectedTaskIds}
          onTaskClick={handleTaskClick}
          onTaskDoubleClick={handleTaskDoubleClick}
        />
      </div>

      {showNewTaskModal && (
        <TaskModal
          task={null}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

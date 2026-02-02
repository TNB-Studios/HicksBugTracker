import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import TaskList from './TaskList';
import TaskDetailsPanel from './TaskDetailsPanel';
import TaskModal from '../TaskModal/TaskModal';
import './ListView.css';

export default function ListView({ triggerNewTask }) {
  const { currentBoard, loading, selectedTaskIds, selectTask, toggleTaskSelection } = useApp();
  const [detailTaskId, setDetailTaskId] = useState(null); // Task shown in detail panel
  const [panelWidth, setPanelWidth] = useState(400);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const prevTriggerNewTask = useRef(triggerNewTask);

  // Open new task modal when triggered from header
  useEffect(() => {
    if (triggerNewTask > 0 && triggerNewTask !== prevTriggerNewTask.current) {
      setShowNewTaskModal(true);
    }
    prevTriggerNewTask.current = triggerNewTask;
  }, [triggerNewTask]);

  const handleMouseDown = useCallback((e) => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;

    const minWidth = 250;
    const maxWidth = containerRect.width * 0.6;
    setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleTaskClick = useCallback((taskId, e) => {
    if (e.ctrlKey || e.metaKey) {
      toggleTaskSelection(taskId);
    } else {
      selectTask(taskId);
    }
  }, [selectTask, toggleTaskSelection]);

  const handleTaskDoubleClick = useCallback((taskId) => {
    setDetailTaskId(taskId);
  }, []);

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
    <div className="list-view" ref={containerRef}>
      <div className="list-view-content" style={{ marginRight: panelWidth }}>
        <TaskList
          selectedTaskIds={selectedTaskIds}
          onTaskClick={handleTaskClick}
          onTaskDoubleClick={handleTaskDoubleClick}
        />
      </div>

      <div
        className="list-view-resizer"
        style={{ right: panelWidth }}
        onMouseDown={handleMouseDown}
      />

      <div className="list-view-details" style={{ width: panelWidth }}>
        <TaskDetailsPanel taskId={detailTaskId} />
      </div>

      {showNewTaskModal && (
        <TaskModal
          task={null}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}
    </div>
  );
}

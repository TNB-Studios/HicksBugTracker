import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import TaskList from './TaskList';
import TaskDetailsPanel from './TaskDetailsPanel';
import TaskModal from '../TaskModal/TaskModal';
import './ListView.css';

export default function ListView({ triggerNewTask }) {
  const { currentBoard, loading, user } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [panelWidth, setPanelWidth] = useState(400); // Default width in pixels
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  // Open new task modal when triggered from header
  useEffect(() => {
    if (triggerNewTask > 0) {
      setShowNewTaskModal(true);
    }
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

    // Constrain between 250px and 60% of container width
    const minWidth = 250;
    const maxWidth = containerRect.width * 0.6;
    setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

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
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      </div>

      <div
        className="list-view-resizer"
        style={{ right: panelWidth }}
        onMouseDown={handleMouseDown}
      />

      <div className="list-view-details" style={{ width: panelWidth }}>
        <TaskDetailsPanel taskId={selectedTaskId} />
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

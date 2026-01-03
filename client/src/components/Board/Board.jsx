import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import Column from './Column';
import TaskCard from './TaskCard';
import TaskModal from '../TaskModal/TaskModal';
import DependencyDialog from './DependencyDialog';
import { useApp } from '../../context/AppContext';

// Columns that require dependency check
const DEPENDENCY_CHECK_COLUMNS = ['Next Up', 'Current'];

export default function Board() {
  const {
    currentBoard,
    columns,
    tasks,
    getFilteredTasks,
    moveTask,
    createColumn,
    loading
  } = useApp();

  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);

  // Dependency dialog state
  const [dependencyDialog, setDependencyDialog] = useState({
    show: false,
    task: null,
    parentTask: null,
    targetColumnId: null,
    position: null,
    tasksToMove: []
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const filteredTasks = getFilteredTasks();

  const getTasksForColumn = (columnId) => {
    return filteredTasks.filter(task => task.columnId === columnId);
  };

  // Find all tasks in dependency chain that need to be moved
  const findDependencyChain = (taskId, targetColumnId) => {
    const tasksToMove = [];
    const targetColumn = columns.find(c => c._id === targetColumnId);

    const checkTask = (id) => {
      const task = tasks.find(t => t._id === id);
      if (!task || !task.dependsOn) return;

      const parentTask = tasks.find(t => t._id === task.dependsOn);
      if (!parentTask) return;

      // Check if parent is in the target column or a "later" column
      const parentColumn = columns.find(c => c._id === parentTask.columnId);
      const targetIndex = columns.findIndex(c => c._id === targetColumnId);
      const parentIndex = columns.findIndex(c => c._id === parentTask.columnId);

      // If parent is in an earlier column than target, it needs to be moved
      if (parentIndex < targetIndex && DEPENDENCY_CHECK_COLUMNS.includes(targetColumn?.name)) {
        tasksToMove.push(parentTask);
        // Recursively check parent's dependencies
        checkTask(parentTask._id);
      }
    };

    checkTask(taskId);
    return tasksToMove;
  };

  const handleDragStart = (event) => {
    const task = filteredTasks.find(t => t._id === event.active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id;
    const task = filteredTasks.find(t => t._id === taskId);
    if (!task) return;

    // Determine the target column
    let targetColumnId = over.id;

    // Check if we dropped on a task (get its column)
    const overTask = filteredTasks.find(t => t._id === over.id);
    if (overTask) {
      targetColumnId = overTask.columnId;
    }

    // Check if target is a column
    const targetColumn = columns.find(c => c._id === targetColumnId);
    if (!targetColumn) return;

    // If same column and same position, do nothing
    if (task.columnId === targetColumnId && !overTask) return;

    // Calculate position
    let position;
    if (overTask) {
      const columnTasks = getTasksForColumn(targetColumnId);
      position = columnTasks.findIndex(t => t._id === overTask._id);
    }

    // Check for dependency issues when moving to Next Up or Current
    if (DEPENDENCY_CHECK_COLUMNS.includes(targetColumn.name) && task.dependsOn) {
      const tasksToMove = findDependencyChain(taskId, targetColumnId);

      if (tasksToMove.length > 0) {
        // Show dependency dialog
        setDependencyDialog({
          show: true,
          task,
          parentTask: tasksToMove[0],
          targetColumnId,
          position,
          tasksToMove
        });
        return;
      }
    }

    await moveTask(taskId, targetColumnId, position);
  };

  const handleDependencyDialogConfirm = async () => {
    const { task, targetColumnId, position, tasksToMove } = dependencyDialog;

    // Move all parent tasks first (in reverse order so deepest dependency moves first)
    for (const parentTask of [...tasksToMove].reverse()) {
      await moveTask(parentTask._id, targetColumnId);
    }

    // Then move the original task
    await moveTask(task._id, targetColumnId, position);

    setDependencyDialog({ show: false, task: null, parentTask: null, targetColumnId: null, position: null, tasksToMove: [] });
  };

  const handleDependencyDialogCancel = () => {
    setDependencyDialog({ show: false, task: null, parentTask: null, targetColumnId: null, position: null, tasksToMove: [] });
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleAddColumn = async () => {
    if (newColumnName.trim()) {
      await createColumn(newColumnName.trim());
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setShowTaskModal(true);
  };

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
    <div className="board">
      <div className="board-header">
        <button className="btn btn-primary" onClick={handleNewTask}>
          + New Task
        </button>
        <h2>{currentBoard.name}</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="columns-container">
          {columns.map(column => (
            <Column
              key={column._id}
              column={column}
              tasks={getTasksForColumn(column._id)}
              onTaskClick={handleTaskClick}
              allTasks={tasks}
            />
          ))}

          <div className="add-column">
            {showAddColumn ? (
              <div className="add-column-form">
                <input
                  type="text"
                  placeholder="Column name"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  autoFocus
                />
                <div className="add-column-buttons">
                  <button onClick={handleAddColumn}>Add</button>
                  <button onClick={() => setShowAddColumn(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                className="add-column-btn"
                onClick={() => setShowAddColumn(true)}
              >
                + Add Column
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard task={activeTask} onClick={() => {}} allTasks={tasks} />
          )}
        </DragOverlay>
      </DndContext>

      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
        />
      )}

      {dependencyDialog.show && (
        <DependencyDialog
          task={dependencyDialog.task}
          tasksToMove={dependencyDialog.tasksToMove}
          onConfirm={handleDependencyDialogConfirm}
          onCancel={handleDependencyDialogCancel}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
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
const DEPENDENCY_CHECK_COLUMNS = ['Next Up', 'Working On'];

export default function Board({ triggerNewTask }) {
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
  const [sortAscending, setSortAscending] = useState(true);

  // Open new task modal when triggered from header
  useEffect(() => {
    if (triggerNewTask > 0) {
      setSelectedTask(null);
      setShowTaskModal(true);
    }
  }, [triggerNewTask]);

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
    const colIdStr = String(columnId);
    return filteredTasks
      .filter(task => String(task.columnId) === colIdStr)
      .sort((a, b) => {
        const diff = new Date(a.createdAt) - new Date(b.createdAt);
        return sortAscending ? diff : -diff;
      });
  };

  const toggleSort = () => setSortAscending(prev => !prev);

  // Find all tasks in dependency chain that need to be moved
  const findDependencyChain = (taskId, targetColumnId) => {
    const tasksToMove = [];
    const targetColStr = String(targetColumnId);
    const targetColumn = columns.find(c => String(c._id) === targetColStr);

    const checkTask = (id) => {
      const idStr = String(id);
      const task = tasks.find(t => String(t._id) === idStr);
      if (!task || !task.dependsOn) return;

      const dependsOnStr = String(task.dependsOn);
      const parentTask = tasks.find(t => String(t._id) === dependsOnStr);
      if (!parentTask) return;

      // Check if parent is in the target column or a "later" column
      const parentColStr = String(parentTask.columnId);
      const targetIndex = columns.findIndex(c => String(c._id) === targetColStr);
      const parentIndex = columns.findIndex(c => String(c._id) === parentColStr);

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
    const activeIdStr = String(event.active.id);
    const task = filteredTasks.find(t => String(t._id) === activeIdStr);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id;
    const taskIdStr = String(taskId);
    const task = filteredTasks.find(t => String(t._id) === taskIdStr);
    if (!task) return;

    // Determine the target column
    let targetColumnId = over.id;

    // Check if we dropped on a task (get its column)
    const overIdStr = String(over.id);
    const overTask = filteredTasks.find(t => String(t._id) === overIdStr);
    if (overTask) {
      targetColumnId = overTask.columnId;
    }

    // Check if target is a column
    const targetColStr = String(targetColumnId);
    const targetColumn = columns.find(c => String(c._id) === targetColStr);
    if (!targetColumn) return;

    // If same column and same position, do nothing
    if (String(task.columnId) === targetColStr && !overTask) return;

    // Calculate position
    let position;
    if (overTask) {
      const columnTasks = getTasksForColumn(targetColumnId);
      const overTaskIdStr = String(overTask._id);
      position = columnTasks.findIndex(t => String(t._id) === overTaskIdStr);
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
              onToggleSort={toggleSort}
              sortAscending={sortAscending}
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

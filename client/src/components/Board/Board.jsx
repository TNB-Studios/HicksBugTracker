import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  getFirstCollision
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import Column from './Column';
import SortableColumn from './SortableColumn';
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
    reorderColumns,
    loading
  } = useApp();

  const [activeTask, setActiveTask] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
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

  // Custom collision detection that handles columns and tasks differently
  const collisionDetection = useCallback((args) => {
    const { active, droppableContainers } = args;

    // If dragging a column, only consider other columns as drop targets
    if (active.data.current?.type === 'column') {
      const columnIds = columns.map(c => String(c._id));
      const columnContainers = droppableContainers.filter(
        container => columnIds.includes(String(container.id))
      );
      return closestCenter({ ...args, droppableContainers: columnContainers });
    }

    // For tasks, use pointer within first, then fall back to closest center
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  }, [columns]);

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
    const { active } = event;
    const activeIdStr = String(active.id);

    // Check if dragging a column
    if (active.data.current?.type === 'column') {
      setActiveColumn(active.data.current.column);
      setActiveTask(null);
      return;
    }

    // Otherwise it's a task
    const task = filteredTasks.find(t => String(t._id) === activeIdStr);
    setActiveTask(task);
    setActiveColumn(null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    // Handle column reordering
    if (active.data.current?.type === 'column') {
      const activeColId = String(active.id);
      const overColId = String(over.id);

      if (activeColId !== overColId) {
        const oldIndex = columns.findIndex(c => String(c._id) === activeColId);
        const newIndex = columns.findIndex(c => String(c._id) === overColId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(columns, oldIndex, newIndex).map(c => c._id);
          await reorderColumns(newOrder);
        }
      }
      return;
    }

    // Handle task movement
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
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{
          enabled: true,
          threshold: {
            x: 0.15,
            y: 0.15
          },
          acceleration: 15
        }}
      >
        <SortableContext
          items={columns.map(c => c._id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="columns-container">
            {columns.map(column => (
              <SortableColumn
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
        </SortableContext>

        <DragOverlay>
          {activeTask && (
            <TaskCard task={activeTask} onClick={() => {}} allTasks={tasks} />
          )}
          {activeColumn && (
            <div className="column column-drag-overlay">
              <div className="column-header">
                <h3 className="column-title">{activeColumn.name}</h3>
              </div>
              <div className="column-tasks">
                {getTasksForColumn(activeColumn._id).slice(0, 3).map(task => (
                  <TaskCard key={task._id} task={task} onClick={() => {}} allTasks={tasks} />
                ))}
                {getTasksForColumn(activeColumn._id).length > 3 && (
                  <div className="column-more-tasks">
                    +{getTasksForColumn(activeColumn._id).length - 3} more
                  </div>
                )}
              </div>
            </div>
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

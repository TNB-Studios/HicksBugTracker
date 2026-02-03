import { useState, useEffect, useCallback, useRef } from 'react';
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
    loading,
    selectedTaskIds,
    selectTask,
    toggleTaskSelection,
    clearSelection,
    selectMultipleTasks,
    userTaskOrder,
    setUserColumnOrder
  } = useApp();

  const [activeTask, setActiveTask] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [draggedTasks, setDraggedTasks] = useState([]); // Tasks being dragged (multi-select)
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const prevTriggerNewTask = useRef(triggerNewTask);

  // Drag-select state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionCurrent, setSelectionCurrent] = useState(null);
  const columnsContainerRef = useRef(null);
  const taskRefs = useRef(new Map()); // Map of taskId -> DOM element

  // Anchor task for Shift+click range selection
  const [anchorTaskId, setAnchorTaskId] = useState(null);

  // Open new task modal when triggered from header
  useEffect(() => {
    if (triggerNewTask > 0 && triggerNewTask !== prevTriggerNewTask.current) {
      setSelectedTask(null);
      setShowTaskModal(true);
    }
    prevTriggerNewTask.current = triggerNewTask;
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

  // Helper to check if an ID is a column drop zone
  const isColumnDropZone = (id) => String(id).startsWith('column-drop-');
  const getColumnIdFromDropZone = (id) => String(id).replace('column-drop-', '');

  // Custom collision detection that handles columns and tasks differently
  const collisionDetection = useCallback((args) => {
    const { active, droppableContainers } = args;
    const columnIds = columns.map(c => String(c._id));

    // Helper to check if ID is a column (either sortable or drop zone)
    const isColumnTarget = (id) => {
      const idStr = String(id);
      return isColumnDropZone(idStr) || columnIds.includes(idStr);
    };

    // If dragging a column, only consider other sortable columns as drop targets
    if (active.data.current?.type === 'column') {
      const columnContainers = droppableContainers.filter(
        container => columnIds.includes(String(container.id))
      );
      return closestCenter({ ...args, droppableContainers: columnContainers });
    }

    // For tasks: first find which column we're over using pointerWithin
    const dropZoneContainers = droppableContainers.filter(c => isColumnDropZone(c.id));
    const columnIntersections = pointerWithin({ ...args, droppableContainers: dropZoneContainers });

    if (columnIntersections.length > 0) {
      // We're over a column - now check if we're over a task in that column
      const targetColumnDropZone = columnIntersections[0];
      const targetColumnId = getColumnIdFromDropZone(targetColumnDropZone.id);

      // Get tasks that belong to this column
      const activeId = String(active.id);
      const columnTaskIds = columns.find(c => String(c._id) === targetColumnId)?.taskIds?.map(id => String(id)) || [];

      const tasksInColumn = droppableContainers.filter(container => {
        const containerId = String(container.id);
        return columnTaskIds.includes(containerId) && containerId !== activeId;
      });

      // Check if pointer is over any task in this column
      if (tasksInColumn.length > 0) {
        const taskCollisions = pointerWithin({ ...args, droppableContainers: tasksInColumn });
        if (taskCollisions.length > 0) {
          return taskCollisions;
        }

        // Not directly over a task - use closestCenter to find nearest task in column
        const closestTask = closestCenter({ ...args, droppableContainers: tasksInColumn });
        if (closestTask.length > 0) {
          return closestTask;
        }
      }

      // No task found in column - return the column drop zone
      return [targetColumnDropZone];
    }

    // Fallback: find closest column drop zone
    if (dropZoneContainers.length > 0) {
      return closestCenter({ ...args, droppableContainers: dropZoneContainers });
    }

    return [];
  }, [columns]);

  const filteredTasks = getFilteredTasks();

  const getTasksForColumn = (columnId) => {
    const colIdStr = String(columnId);
    const column = columns.find(c => String(c._id) === colIdStr);

    // Use user's custom order if available, otherwise fall back to column.taskIds
    const userOrder = userTaskOrder[colIdStr];
    const taskIds = userOrder || column?.taskIds?.map(id => String(id)) || [];

    const columnTasks = filteredTasks.filter(task => String(task.columnId) === colIdStr);

    return columnTasks.sort((a, b) => {
      const aIndex = taskIds.indexOf(String(a._id));
      const bIndex = taskIds.indexOf(String(b._id));
      // Tasks in taskIds array are sorted by their position
      // Tasks not in array go to the beginning (new tasks), sorted by createdAt desc
      if (aIndex === -1 && bIndex === -1) {
        return new Date(b.createdAt) - new Date(a.createdAt); // Newest first at top
      }
      if (aIndex === -1) return -1; // New tasks go to top
      if (bIndex === -1) return 1;
      return aIndex - bIndex;
    });
  };

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
      setDraggedTasks([]);
      return;
    }

    // Otherwise it's a task
    const task = filteredTasks.find(t => String(t._id) === activeIdStr);
    setActiveTask(task);
    setActiveColumn(null);

    // If the dragged task is selected, find all selected tasks in the same column
    // Use string comparison for ID matching
    const selectedIdsAsStrings = selectedTaskIds.map(id => String(id));
    const taskIdStr = task ? String(task._id) : '';

    if (task && selectedIdsAsStrings.includes(taskIdStr)) {
      const tasksInSameColumn = filteredTasks.filter(t =>
        selectedIdsAsStrings.includes(String(t._id)) && String(t.columnId) === String(task.columnId)
      );
      setDraggedTasks(tasksInSameColumn);
    } else {
      // Just dragging a single unselected task
      setDraggedTasks(task ? [task] : []);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const currentDraggedTasks = [...draggedTasks];
    setActiveTask(null);
    setActiveColumn(null);
    setDraggedTasks([]);

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
    const overIdStr = String(over.id);
    let targetColumnId;

    // Check if we dropped on a column drop zone
    if (isColumnDropZone(overIdStr)) {
      targetColumnId = getColumnIdFromDropZone(overIdStr);
    }
    // Check if we dropped directly on a sortable column
    else if (columns.find(c => String(c._id) === overIdStr)) {
      targetColumnId = overIdStr;
    }
    // Check if we dropped on a task (get its column)
    else {
      const overTask = filteredTasks.find(t => String(t._id) === overIdStr);
      if (overTask) {
        targetColumnId = overTask.columnId;
      } else {
        // Unknown target
        return;
      }
    }

    // Find the target column
    const targetColStr = String(targetColumnId);
    const targetColumn = columns.find(c => String(c._id) === targetColStr);
    if (!targetColumn) return;

    // Check if we dropped on a task for position calculation
    const overTask = filteredTasks.find(t => String(t._id) === overIdStr);
    const isSameColumn = String(task.columnId) === targetColStr;

    // Calculate position
    let position;
    if (overTask) {
      const columnTasks = getTasksForColumn(targetColumnId);
      const overTaskIdStr = String(overTask._id);
      const overIndex = columnTasks.findIndex(t => String(t._id) === overTaskIdStr);
      const activeIndex = columnTasks.findIndex(t => String(t._id) === taskIdStr);

      if (isSameColumn) {
        // Same column reordering - if moving down, account for removal
        if (activeIndex < overIndex) {
          position = overIndex; // Will be inserted at this position after removal
        } else {
          position = overIndex;
        }
        // If dropped on itself, do nothing
        if (activeIndex === overIndex) return;
      } else {
        position = overIndex;
      }
    } else if (isSameColumn) {
      // Dropped on empty space in same column - do nothing
      return;
    }

    // Move all dragged tasks (multi-select drag)
    if (currentDraggedTasks.length > 1) {
      // Sort tasks by their current position in the column to maintain order
      const columnTasks = getTasksForColumn(task.columnId);
      const sortedDraggedTasks = [...currentDraggedTasks].sort((a, b) => {
        const aIndex = columnTasks.findIndex(t => t._id === a._id);
        const bIndex = columnTasks.findIndex(t => t._id === b._id);
        return aIndex - bIndex;
      });

      // Move all tasks in parallel for instant feedback
      await Promise.all(
        sortedDraggedTasks.map((t, i) => {
          const insertPosition = position !== undefined ? position + i : undefined;
          return moveTask(t._id, targetColumnId, insertPosition);
        })
      );

      // Save user order for target column after multi-task move
      const updatedColumnTasks = getTasksForColumn(targetColumnId);
      // Recalculate after state update - need to get from what the order will be
      const newOrder = computeNewTaskOrder(columnTasks, sortedDraggedTasks.map(t => t._id), targetColumnId, position, isSameColumn);
      setUserColumnOrder(targetColumnId, newOrder);
      return;
    }

    // Single task drag - check for dependency issues when moving to Next Up or Current
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

    // Save user order for target column after single task move
    const targetColumnTasks = getTasksForColumn(targetColumnId);
    const newOrder = computeNewTaskOrder(targetColumnTasks, [taskIdStr], targetColumnId, position, isSameColumn);
    setUserColumnOrder(targetColumnId, newOrder);
  };

  // Compute the new task order after a drag operation
  const computeNewTaskOrder = (currentColumnTasks, movedTaskIds, targetColumnId, position, isSameColumn) => {
    const taskIdStrs = movedTaskIds.map(id => String(id));

    // Get current order
    let currentIds = currentColumnTasks.map(t => String(t._id));

    if (isSameColumn) {
      // Remove moved tasks from current position
      currentIds = currentIds.filter(id => !taskIdStrs.includes(id));
    }

    // Insert at new position
    if (position !== undefined && position >= 0) {
      currentIds.splice(position, 0, ...taskIdStrs);
    } else {
      currentIds.push(...taskIdStrs);
    }

    return currentIds;
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

  const handleTaskClick = (task, e) => {
    const filteredTasks = getFilteredTasks();

    // Shift+click for range selection (same column only)
    if (e.shiftKey && anchorTaskId) {
      const anchorTask = filteredTasks.find(t => String(t._id) === String(anchorTaskId));

      // Only do range selection if anchor exists and is in the same column
      if (anchorTask && anchorTask.columnId === task.columnId) {
        // Get tasks in this column in display order
        const columnTasks = filteredTasks.filter(t => t.columnId === task.columnId);
        const anchorIndex = columnTasks.findIndex(t => String(t._id) === String(anchorTaskId));
        const clickedIndex = columnTasks.findIndex(t => String(t._id) === String(task._id));

        if (anchorIndex !== -1 && clickedIndex !== -1) {
          const startIndex = Math.min(anchorIndex, clickedIndex);
          const endIndex = Math.max(anchorIndex, clickedIndex);
          const tasksInRange = columnTasks.slice(startIndex, endIndex + 1);
          selectMultipleTasks(tasksInRange.map(t => t._id));
          return;
        }
      }
      // Anchor not in same column or not found - just select clicked task
      selectTask(task._id);
      setAnchorTaskId(task._id);
    }
    // Ctrl/Cmd+click to toggle selection
    else if (e.ctrlKey || e.metaKey) {
      toggleTaskSelection(task._id);
      // Set anchor to clicked task if nothing selected, or keep existing
      if (selectedTaskIds.length === 0) {
        setAnchorTaskId(task._id);
      }
    }
    // Regular click - select single task and set as anchor
    else {
      selectTask(task._id);
      setAnchorTaskId(task._id);
    }
  };

  const handleTaskDoubleClick = (task) => {
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

  // Register task DOM element refs for drag-select intersection
  const registerTaskRef = useCallback((taskId, element) => {
    if (element) {
      taskRefs.current.set(taskId, element);
    } else {
      taskRefs.current.delete(taskId);
    }
  }, []);

  // Calculate selection rectangle bounds
  const getSelectionRect = useCallback(() => {
    if (!selectionStart || !selectionCurrent) return null;
    return {
      left: Math.min(selectionStart.x, selectionCurrent.x),
      top: Math.min(selectionStart.y, selectionCurrent.y),
      width: Math.abs(selectionCurrent.x - selectionStart.x),
      height: Math.abs(selectionCurrent.y - selectionStart.y),
    };
  }, [selectionStart, selectionCurrent]);

  // Check if two rectangles intersect
  const rectsIntersect = (rect1, rect2) => {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  };

  // Find tasks that intersect with selection rectangle
  const getTasksInSelection = useCallback(() => {
    const selectionRect = getSelectionRect();
    if (!selectionRect || !columnsContainerRef.current) return [];

    const containerRect = columnsContainerRef.current.getBoundingClientRect();
    const absSelectionRect = {
      left: selectionRect.left + containerRect.left + columnsContainerRef.current.scrollLeft,
      top: selectionRect.top + containerRect.top + columnsContainerRef.current.scrollTop,
      right: selectionRect.left + selectionRect.width + containerRect.left + columnsContainerRef.current.scrollLeft,
      bottom: selectionRect.top + selectionRect.height + containerRect.top + columnsContainerRef.current.scrollTop,
    };

    const selectedIds = [];
    taskRefs.current.forEach((element, taskId) => {
      const taskRect = element.getBoundingClientRect();
      if (rectsIntersect(absSelectionRect, taskRect)) {
        selectedIds.push(taskId);
      }
    });

    return selectedIds;
  }, [getSelectionRect]);

  // Update selection during drag
  useEffect(() => {
    if (isSelecting) {
      const taskIds = getTasksInSelection();
      selectMultipleTasks(taskIds);
    }
  }, [isSelecting, selectionCurrent, getTasksInSelection, selectMultipleTasks]);

  // Drag-select mouse handlers
  const handleSelectionMouseDown = useCallback((e) => {
    // Only start selection if clicking on empty space (columns-container background)
    // and not during a dnd-kit drag
    if (e.target.closest('.task-card') || e.target.closest('.column-header') || activeTask || activeColumn) {
      return;
    }

    // Don't start selection if clicking on add-column
    if (e.target.closest('.add-column')) {
      return;
    }

    const containerRect = columnsContainerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left + columnsContainerRef.current.scrollLeft;
    const y = e.clientY - containerRect.top + columnsContainerRef.current.scrollTop;

    setSelectionStart({ x, y });
    setSelectionCurrent({ x, y });
    setIsSelecting(true);

    // Clear existing selection unless Ctrl/Cmd is held
    if (!e.ctrlKey && !e.metaKey) {
      clearSelection();
    }
  }, [activeTask, activeColumn, clearSelection]);

  const handleSelectionMouseMove = useCallback((e) => {
    if (!isSelecting || !columnsContainerRef.current) return;

    const containerRect = columnsContainerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left + columnsContainerRef.current.scrollLeft;
    const y = e.clientY - containerRect.top + columnsContainerRef.current.scrollTop;

    setSelectionCurrent({ x, y });
  }, [isSelecting]);

  const handleSelectionMouseUp = useCallback(() => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionCurrent(null);
  }, []);

  // Add global mouse event listeners for drag-select
  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mousemove', handleSelectionMouseMove);
      document.addEventListener('mouseup', handleSelectionMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleSelectionMouseMove);
        document.removeEventListener('mouseup', handleSelectionMouseUp);
      };
    }
  }, [isSelecting, handleSelectionMouseMove, handleSelectionMouseUp]);

  const selectionRect = getSelectionRect();

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
          <div
            className="columns-container"
            ref={columnsContainerRef}
            onMouseDown={handleSelectionMouseDown}
          >
            {isSelecting && selectionRect && (
              <div
                className="selection-rectangle"
                style={{
                  left: selectionRect.left,
                  top: selectionRect.top,
                  width: selectionRect.width,
                  height: selectionRect.height,
                }}
              />
            )}
            {columns.map(column => (
              <SortableColumn
                key={column._id}
                column={column}
                tasks={getTasksForColumn(column._id)}
                onTaskClick={handleTaskClick}
                onTaskDoubleClick={handleTaskDoubleClick}
                allTasks={tasks}
                selectedTaskIds={selectedTaskIds}
                registerTaskRef={registerTaskRef}
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
            <div className="drag-overlay-tasks">
              {draggedTasks.map((task) => (
                <div key={task._id} className="drag-overlay-card">
                  <TaskCard task={task} onClick={() => {}} allTasks={tasks} />
                </div>
              ))}
            </div>
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

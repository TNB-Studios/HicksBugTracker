import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const priorityColors = {
  Low: '#4caf50',
  Medium: '#ff9800',
  High: '#f44336',
  Critical: '#9c27b0'
};

const stateColors = {
  'Backlog': '#9e9e9e',
  'Next Up': '#2196f3',
  'Current': '#ff9800',
  'Completed': '#4caf50'
};

const typeColors = {
  'Task': '#5c6bc0',
  'Bug': '#e53935',
  'Suggestion': '#43a047'
};

export default function TaskCard({ task, onClick, allTasks = [] }) {
  // Find the parent task name if there's a dependency
  const parentTask = task.dependsOn ? allTasks.find(t => t._id === task.dependsOn) : null;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={() => onClick(task)}
    >
      <div className="task-card-header">
        <span
          className="task-type"
          style={{ backgroundColor: typeColors[task.taskType || 'Task'] }}
        >
          {task.taskType || 'Task'}
        </span>
        <span className="task-name">{task.name}</span>
        <span
          className="task-priority"
          style={{ backgroundColor: priorityColors[task.priority] }}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="task-description">
          {task.description.length > 100
            ? task.description.substring(0, 100) + '...'
            : task.description}
        </p>
      )}

      <div className="task-card-footer">
        {task.assignedTo && (
          <span className="task-assigned">
            {task.assignedTo}
          </span>
        )}
        <span
          className="task-state"
          style={{ backgroundColor: stateColors[task.state] }}
        >
          {task.state}
        </span>
      </div>

      {parentTask && (
        <div className="task-dependency">
          Depends on: {parentTask.name}
        </div>
      )}

      {task.comments && task.comments.length > 0 && (
        <div className="task-comments-count">
          {task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

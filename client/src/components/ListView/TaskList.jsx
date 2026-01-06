import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

const priorityColors = {
  Low: '#4caf50',
  Medium: '#ff9800',
  High: '#f44336',
  Critical: '#9c27b0'
};

const priorityOrder = { Low: 0, Medium: 1, High: 2, Critical: 3 };

const typeColors = {
  'Task': '#5c6bc0',
  'Bug': '#e53935',
  'Suggestion': '#43a047'
};

export default function TaskList({ selectedTaskId, onSelectTask }) {
  const { tasks, getFilteredTasks, columns } = useApp();
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const filteredTasks = getFilteredTasks();

  const getColumnName = (columnId) => {
    const col = columns.find(c => String(c._id) === String(columnId));
    return col?.name || '';
  };

  const getColumnOrder = (columnId) => {
    const idx = columns.findIndex(c => String(c._id) === String(columnId));
    return idx >= 0 ? idx : 999;
  };

  const sortTasks = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'type':
          aVal = a.taskType || 'Task';
          bVal = b.taskType || 'Task';
          break;
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'state':
          aVal = getColumnOrder(a.columnId);
          bVal = getColumnOrder(b.columnId);
          break;
        case 'priority':
          aVal = priorityOrder[a.priority] ?? 1;
          bVal = priorityOrder[b.priority] ?? 1;
          break;
        case 'assigned':
          aVal = (a.assignedTo || '').toLowerCase();
          bVal = (b.assignedTo || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Build a map of parent ID -> children (tasks that depend on that parent)
  const childrenMap = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach(task => {
      if (task.dependsOn) {
        const parentId = String(task.dependsOn);
        if (!map.has(parentId)) {
          map.set(parentId, []);
        }
        map.get(parentId).push(task);
      }
    });
    return map;
  }, [filteredTasks]);

  // Find root tasks (tasks with no parent, or parent not in filtered list), then sort
  const rootTasks = useMemo(() => {
    const filteredIds = new Set(filteredTasks.map(t => String(t._id)));
    const roots = filteredTasks.filter(task => {
      if (!task.dependsOn) return true;
      // If parent is not in filtered list, treat as root
      return !filteredIds.has(String(task.dependsOn));
    });
    return sortTasks(roots);
  }, [filteredTasks, sortColumn, sortDirection, columns]);

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getSortIndicator = (column) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const renderTask = (task, depth = 0) => {
    const taskId = String(task._id);
    const children = childrenMap.get(taskId) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedTasks.has(taskId);
    const isSelected = selectedTaskId === task._id;

    return (
      <div key={taskId} className="task-list-item-container">
        <div
          className={`task-list-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: depth * 24 + 8 }}
          onClick={() => onSelectTask(task._id)}
        >
          <div className="task-list-expand">
            {hasChildren ? (
              <button
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(taskId);
                }}
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className="expand-placeholder" />
            )}
          </div>

          <span
            className="task-list-type"
            style={{ backgroundColor: typeColors[task.taskType] || typeColors.Task }}
          >
            {task.taskType?.[0] || 'T'}
          </span>

          <span className="task-list-name">{task.name}</span>

          <span className="task-list-state">{getColumnName(task.columnId)}</span>

          <span
            className="task-list-priority"
            style={{ backgroundColor: priorityColors[task.priority] }}
          >
            {task.priority?.[0] || 'M'}
          </span>

          {task.assignedTo && (
            <span className="task-list-assigned">{task.assignedTo}</span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="task-list-children">
            {sortTasks(children).map(child => renderTask(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="task-list-empty">
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      <div className="task-list-header">
        <span className="task-list-header-expand"></span>
        <span className="task-list-header-type sortable" onClick={() => handleSort('type')}>
          Type{getSortIndicator('type')}
        </span>
        <span className="task-list-header-name sortable" onClick={() => handleSort('name')}>
          Name{getSortIndicator('name')}
        </span>
        <span className="task-list-header-state sortable" onClick={() => handleSort('state')}>
          State{getSortIndicator('state')}
        </span>
        <span className="task-list-header-priority sortable" onClick={() => handleSort('priority')}>
          Pri{getSortIndicator('priority')}
        </span>
        <span className="task-list-header-assigned sortable" onClick={() => handleSort('assigned')}>
          Assigned{getSortIndicator('assigned')}
        </span>
      </div>
      <div className="task-list-body">
        {rootTasks.map(task => renderTask(task, 0))}
      </div>
    </div>
  );
}

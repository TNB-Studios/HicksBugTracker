import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import { useApp } from '../../context/AppContext';
import { useState } from 'react';

export default function Column({ column, tasks, onTaskClick, allTasks, onToggleSort, sortAscending }) {
  const { deleteColumn, updateColumn } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);

  const { setNodeRef, isOver } = useDroppable({
    id: column._id
  });

  const handleDelete = async () => {
    if (column.isDefault) {
      alert('Cannot delete default columns');
      return;
    }
    if (window.confirm(`Delete column "${column.name}"? Tasks will be moved to Backlog.`)) {
      await deleteColumn(column._id);
    }
  };

  const handleRename = async () => {
    if (editName.trim() && editName !== column.name) {
      await updateColumn(column._id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(column.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`column ${isOver ? 'column-over' : ''}`}
      ref={setNodeRef}
    >
      <div className="column-header">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
            className="column-name-input"
          />
        ) : (
          <h3
            onClick={onToggleSort}
            onDoubleClick={() => !column.isDefault && setIsEditing(true)}
            className="column-title"
          >
            {column.name}
            <span className="sort-indicator">{sortAscending ? ' ▲' : ' ▼'}</span>
            <span className="task-count">({tasks.length})</span>
          </h3>
        )}
        {!column.isDefault && (
          <button
            className="column-delete-btn"
            onClick={handleDelete}
            title="Delete column"
          >
            &times;
          </button>
        )}
      </div>

      <SortableContext
        items={tasks.map(t => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="column-tasks">
          {tasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              onClick={onTaskClick}
              allTasks={allTasks}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const SORT_OPTIONS = [
  { label: 'Priority (High\u2192Low)', sortBy: 'priority', sortDir: 'asc' },
  { label: 'Priority (Low\u2192High)', sortBy: 'priority', sortDir: 'desc' },
  { label: 'Assignee (A\u2192Z)', sortBy: 'assignedTo', sortDir: 'asc' },
  { label: 'Assignee (Z\u2192A)', sortBy: 'assignedTo', sortDir: 'desc' },
  { label: 'Reporter (A\u2192Z)', sortBy: 'reportedBy', sortDir: 'asc' },
  { label: 'Reporter (Z\u2192A)', sortBy: 'reportedBy', sortDir: 'desc' },
  { label: 'Name (A\u2192Z)', sortBy: 'name', sortDir: 'asc' },
  { label: 'Name (Z\u2192A)', sortBy: 'name', sortDir: 'desc' },
  { label: 'Type', sortBy: 'taskType', sortDir: 'asc' },
  { label: 'Tags', sortBy: 'tags', sortDir: 'asc' },
  { label: 'Newest First', sortBy: 'createdAt', sortDir: 'desc' },
  { label: 'Oldest First', sortBy: 'createdAt', sortDir: 'asc' }
];

export default function ColumnSortMenu({ columnId }) {
  const { sortColumnTasks } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSort = (sortBy, sortDir) => {
    sortColumnTasks(columnId, sortBy, sortDir);
    setIsOpen(false);
  };

  return (
    <div className="column-sort-menu" ref={menuRef}>
      <button
        className="column-sort-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Sort tasks in this column"
      >
        Sort
      </button>

      {isOpen && (
        <div className="column-sort-dropdown">
          {SORT_OPTIONS.map((option, index) => (
            <button
              key={index}
              className="column-sort-option"
              onClick={() => handleSort(option.sortBy, option.sortDir)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import UserSelect from '../UserSelect/UserSelect';

const TYPES = ['Task', 'Bug', 'Suggestion'];

export default function FilterPanel() {
  const { filters, setFilters, columns, boardUsers, tasks } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  // Get all unique tags from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      (task.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Build summary text for collapsed state
  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    if (filters.taskType.length > 0) parts.push(`Type: ${filters.taskType.join(', ')}`);
    if (filters.state.length > 0) parts.push(`State: ${filters.state.join(', ')}`);
    if (filters.assignedTo) parts.push(`Assigned: ${filters.assignedTo}`);
    if (filters.tags.length > 0) parts.push(`Tags: ${filters.tags.join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : 'No filters active';
  }, [filters]);

  const handleStateToggle = (state) => {
    setFilters(prev => {
      const newStates = prev.state.includes(state)
        ? prev.state.filter(s => s !== state)
        : [...prev.state, state];
      return { ...prev, state: newStates };
    });
  };

  const handleTypeToggle = (type) => {
    setFilters(prev => {
      const newTypes = prev.taskType.includes(type)
        ? prev.taskType.filter(t => t !== type)
        : [...prev.taskType, type];
      return { ...prev, taskType: newTypes };
    });
  };

  const handleTagToggle = (tag) => {
    setFilters(prev => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags: newTags };
    });
  };

  const handleAssignedToChange = (e) => {
    setFilters(prev => ({ ...prev, assignedTo: e.target.value }));
  };

  const handleSearchChange = (e) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const clearFilters = () => {
    setFilters({
      state: [],
      taskType: [],
      assignedTo: '',
      search: '',
      tags: []
    });
  };

  const hasActiveFilters = filters.state.length > 0 || filters.taskType.length > 0 || filters.assignedTo || filters.search || filters.tags.length > 0;

  return (
    <div className={`filter-panel ${isOpen ? 'filter-panel-open' : 'filter-panel-collapsed'}`}>
      <div className="filter-header" onClick={() => setIsOpen(!isOpen)}>
        <span className={`filter-toggle-icon ${isOpen ? 'open' : ''}`}>&#9654;</span>
        <span className="filter-header-label">Filters</span>
        {!isOpen && <span className="filter-summary">{filterSummary}</span>}
        {!isOpen && hasActiveFilters && (
          <button
            className="btn btn-danger btn-small filter-reset-inline"
            onClick={(e) => { e.stopPropagation(); clearFilters(); }}
          >
            Reset
          </button>
        )}
      </div>

      {isOpen && (
        <div className="filter-body">
          <div className="filter-section">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={handleSearchChange}
              className="filter-search"
            />
          </div>

          <div className="filter-section">
            <label>Type:</label>
            <div className="filter-types">
              {TYPES.map(type => (
                <button
                  key={type}
                  className={`filter-type-btn ${filters.taskType.includes(type) ? 'active' : ''}`}
                  onClick={() => handleTypeToggle(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>State:</label>
            <div className="filter-states">
              {columns.map(col => (
                <button
                  key={col._id}
                  className={`filter-state-btn ${filters.state.includes(col.name) ? 'active' : ''}`}
                  onClick={() => handleStateToggle(col.name)}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>Assigned To:</label>
            <UserSelect
              value={filters.assignedTo}
              onChange={handleAssignedToChange}
              users={boardUsers}
              placeholder="Filter by assignee..."
              name="assignedTo"
            />
          </div>

          {allTags.length > 0 && (
            <div className="filter-section">
              <label>Tags:</label>
              <div className="filter-tags">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`filter-tag-btn ${filters.tags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button className="btn btn-danger btn-small" onClick={clearFilters}>
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

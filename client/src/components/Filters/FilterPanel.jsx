import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import UserSelect from '../UserSelect/UserSelect';

const TYPES = ['Task', 'Bug', 'Suggestion'];

export default function FilterPanel() {
  const { filters, setFilters, columns, boardUsers, tasks, customFields } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [customFieldInput, setCustomFieldInput] = useState({}); // For free-text filter inputs
  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState(''); // Tracks dropdown selection for adding

  // Get all unique tags from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      (task.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Get custom fields that are not yet added to filters
  const availableCustomFields = useMemo(() => {
    const activeFieldIds = Object.keys(filters.customFieldFilters || {});
    return (customFields || []).filter(f => !activeFieldIds.includes(f._id));
  }, [customFields, filters.customFieldFilters]);

  // Get active custom field filters with their definitions
  const activeCustomFieldFilters = useMemo(() => {
    const entries = Object.entries(filters.customFieldFilters || {});
    return entries.map(([fieldId, config]) => {
      const fieldDef = (customFields || []).find(f => f._id === fieldId);
      return { fieldId, config, fieldDef };
    }).filter(item => item.fieldDef); // Only include if field definition exists
  }, [filters.customFieldFilters, customFields]);

  // Build summary text for collapsed state
  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    if (filters.taskType.length > 0) parts.push(`Type: ${filters.taskType.join(', ')}`);
    if (filters.state.length > 0) parts.push(`State: ${filters.state.join(', ')}`);
    if (filters.assignedTo) parts.push(`Assigned: ${filters.assignedTo}`);
    if (filters.tags.length > 0) parts.push(`Tags: ${filters.tags.join(', ')}`);
    // Add custom field filter summary
    activeCustomFieldFilters.forEach(({ fieldDef, config }) => {
      if (config.values?.length > 0) {
        parts.push(`${fieldDef.name}: ${config.values.join(', ')}`);
      }
    });
    return parts.length > 0 ? parts.join(' | ') : 'No filters active';
  }, [filters, activeCustomFieldFilters]);

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

  // Custom field filter handlers
  const handleAddCustomFieldFilter = (fieldId) => {
    if (!fieldId) return;
    setFilters(prev => ({
      ...prev,
      customFieldFilters: {
        ...prev.customFieldFilters,
        [fieldId]: { values: [] }
      }
    }));
  };

  const handleRemoveCustomFieldFilter = (fieldId) => {
    setFilters(prev => {
      const newFilters = { ...prev.customFieldFilters };
      delete newFilters[fieldId];
      return { ...prev, customFieldFilters: newFilters };
    });
    // Also clear the text input state for this field
    setCustomFieldInput(prev => {
      const newInput = { ...prev };
      delete newInput[fieldId];
      return newInput;
    });
  };

  const handleCustomFieldValueToggle = (fieldId, value) => {
    setFilters(prev => {
      const currentValues = prev.customFieldFilters[fieldId]?.values || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return {
        ...prev,
        customFieldFilters: {
          ...prev.customFieldFilters,
          [fieldId]: { values: newValues }
        }
      };
    });
  };

  const handleCustomFieldTextInput = (fieldId, text) => {
    setCustomFieldInput(prev => ({ ...prev, [fieldId]: text }));
    // Parse comma-separated values and update filter
    const values = text.split(',').map(v => v.trim()).filter(v => v.length > 0);
    setFilters(prev => ({
      ...prev,
      customFieldFilters: {
        ...prev.customFieldFilters,
        [fieldId]: { values }
      }
    }));
  };

  const clearFilters = () => {
    setFilters({
      state: [],
      taskType: [],
      assignedTo: '',
      search: '',
      tags: [],
      customFieldFilters: {}
    });
    setCustomFieldInput({});
    setSelectedFieldToAdd('');
  };

  const hasActiveFilters = filters.state.length > 0 || filters.taskType.length > 0 || filters.assignedTo || filters.search || filters.tags.length > 0 ||
    Object.values(filters.customFieldFilters || {}).some(c => c.values?.length > 0);

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

          {/* User Param Filters - only show if custom fields exist for this board */}
          {customFields?.length > 0 && (
            <div className="filter-section">
              <label>User Param<br/>Filter:</label>
              {availableCustomFields.length > 0 && (
                <>
                  <select
                    className="user-param-filter-select"
                    value={selectedFieldToAdd || availableCustomFields[0]?._id || ''}
                    onChange={(e) => setSelectedFieldToAdd(e.target.value)}
                  >
                    {availableCustomFields.map(field => (
                      <option key={field._id} value={field._id}>{field.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => {
                      const fieldId = selectedFieldToAdd || availableCustomFields[0]?._id;
                      if (fieldId) {
                        handleAddCustomFieldFilter(fieldId);
                        setSelectedFieldToAdd('');
                      }
                    }}
                  >
                    Add
                  </button>
                </>
              )}
            </div>
          )}

          {/* Active user param filters - all inline on one full-width line */}
          {activeCustomFieldFilters.length > 0 && (
            <div className="user-param-filter-active">
              {activeCustomFieldFilters.map(({ fieldId, config, fieldDef }) => {
                const sortedOptions = [...(fieldDef.options || [])].sort((a, b) => a.order - b.order);
                return (
                  <div key={fieldId} className="custom-field-filter-item">
                    <span className="custom-field-filter-name">{fieldDef.name}:</span>
                    {fieldDef.allowUserCreatedOptions ? (
                      <input
                        type="text"
                        className="custom-field-filter-text"
                        placeholder="Comma separated values..."
                        value={customFieldInput[fieldId] || ''}
                        onChange={(e) => handleCustomFieldTextInput(fieldId, e.target.value)}
                      />
                    ) : (
                      <div className="custom-field-filter-options">
                        {sortedOptions.map((option, idx) => (
                          <button
                            key={idx}
                            className={`filter-option-btn ${config.values?.includes(option.value) ? 'active' : ''}`}
                            onClick={() => handleCustomFieldValueToggle(fieldId, option.value)}
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="custom-field-filter-remove"
                      onClick={() => handleRemoveCustomFieldFilter(fieldId)}
                      title="Remove filter"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {hasActiveFilters && (
            <div className="filter-reset-row">
              <button className="btn btn-danger btn-small" onClick={clearFilters}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

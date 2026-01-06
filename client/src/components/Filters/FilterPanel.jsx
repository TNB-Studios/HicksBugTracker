import { useApp } from '../../context/AppContext';

const TYPES = ['Task', 'Bug', 'Suggestion'];

export default function FilterPanel() {
  const { filters, setFilters, columns } = useApp();

  // States are derived from column names
  const states = columns.map(col => col.name);

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
      search: ''
    });
  };

  const hasActiveFilters = filters.state.length > 0 || filters.taskType.length > 0 || filters.assignedTo || filters.search;

  return (
    <div className="filter-panel">
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
          {states.map(state => (
            <button
              key={state}
              className={`filter-state-btn ${filters.state.includes(state) ? 'active' : ''}`}
              onClick={() => handleStateToggle(state)}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label>Assigned To:</label>
        <input
          type="text"
          placeholder="Filter by assignee..."
          value={filters.assignedTo}
          onChange={handleAssignedToChange}
          className="filter-assigned"
        />
      </div>

      {hasActiveFilters && (
        <button className="btn btn-danger btn-small" onClick={clearFilters}>
          Reset Filters
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { customFieldApi } from '../../services/api';
import { useApp } from '../../context/AppContext';
import CustomFieldEditor from './CustomFieldEditor';
import './CustomFieldsManager.css';

const createEmptyField = () => ({
  name: '',
  options: [],
  allowUserCreatedOptions: false,
  appliesTo: ['Task', 'Bug', 'Suggestion'],
  showOnBoard: true,
  showInList: true,
  order: 0
});

export default function CustomFieldsManager({ boards }) {
  const { fetchCustomFields, currentBoard } = useApp();
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?._id || '');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch fields from API when selectedBoardId changes
  useEffect(() => {
    if (selectedBoardId) {
      fetchFields();
    }
  }, [selectedBoardId]);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const response = await customFieldApi.getAll(selectedBoardId);
      setFields(response.data.data || []);
    } catch (err) {
      console.error('Error fetching custom fields:', err);
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    setEditingField(createEmptyField());
    setIsCreating(true);
  };

  const handleEditField = (field) => {
    setEditingField({ ...field });
    setIsCreating(false);
  };

  const handleDeleteField = async (fieldId) => {
    if (window.confirm('Are you sure you want to delete this field? It will be removed from all tasks.')) {
      try {
        await customFieldApi.delete(selectedBoardId, fieldId);
        setFields(prev => prev.filter(f => f._id !== fieldId));
        // Also refresh context if editing the current board
        if (selectedBoardId === currentBoard?._id) {
          fetchCustomFields(selectedBoardId);
        }
      } catch (err) {
        alert('Error deleting field: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleSaveField = async (field) => {
    try {
      if (isCreating) {
        const response = await customFieldApi.create(selectedBoardId, field);
        setFields(prev => [...prev, response.data.data].sort((a, b) => a.order - b.order));
      } else {
        const response = await customFieldApi.update(selectedBoardId, field._id, field);
        setFields(prev => prev.map(f => f._id === field._id ? response.data.data : f)
          .sort((a, b) => a.order - b.order));
      }
      setEditingField(null);
      // Also refresh context if editing the current board
      if (selectedBoardId === currentBoard?._id) {
        fetchCustomFields(selectedBoardId);
      }
    } catch (err) {
      alert('Error saving field: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const getAppliesToLabel = (appliesTo) => {
    if (!appliesTo || appliesTo.length === 3) return 'All types';
    return appliesTo.join(', ');
  };

  const getOptionsLabel = (options) => {
    if (!options || options.length === 0) return 'None';
    return options
      .sort((a, b) => a.order - b.order)
      .map(opt => opt.value)
      .join(', ');
  };

  const selectedBoard = boards.find(b => b._id === selectedBoardId);

  return (
    <div className="custom-fields-manager">
      <div className="custom-fields-header">
        <div className="board-selector">
          <label htmlFor="field-board-select">Board:</label>
          <select
            id="field-board-select"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
          >
            {boards.map(board => (
              <option key={board._id} value={board._id}>{board.name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleAddField}>
          + Add Field
        </button>
      </div>

      {loading ? (
        <div className="loading-fields">Loading fields...</div>
      ) : fields.length === 0 ? (
        <div className="no-fields">
          <p>No custom fields defined for "{selectedBoard?.name}".</p>
          <p>Click "Add Field" to create your first custom field.</p>
        </div>
      ) : (
        <div className="fields-list">
          {fields.map(field => (
            <div key={field._id} className="field-card">
              <div className="field-header">
                <span className="field-name">{field.name}</span>
                <div className="field-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => handleEditField(field)}
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteField(field._id)}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="field-summary">
                <span className="field-options">
                  <strong>Options:</strong> {getOptionsLabel(field.options)}
                  {field.allowUserCreatedOptions && ' (+ user can add)'}
                </span>
                <span className="field-applies-to">
                  <strong>Applies to:</strong> {getAppliesToLabel(field.appliesTo)}
                </span>
                <span className="field-visibility">
                  <strong>Show:</strong>
                  {field.showOnBoard && ' Board'}
                  {field.showOnBoard && field.showInList && ','}
                  {field.showInList && ' List'}
                  {!field.showOnBoard && !field.showInList && ' None'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingField && (
        <CustomFieldEditor
          field={editingField}
          isNew={isCreating}
          onSave={handleSaveField}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import './CustomFieldEditor.css';

const TASK_TYPES = ['Task', 'Bug', 'Suggestion'];

export default function CustomFieldEditor({ field, isNew, onSave, onCancel }) {
  // Convert options array to comma-separated string for editing
  const optionsToString = (options) => {
    if (!options || options.length === 0) return '';
    return options
      .sort((a, b) => a.order - b.order)
      .map(opt => opt.value)
      .join(', ');
  };

  const [formData, setFormData] = useState({
    name: field.name || '',
    optionsText: optionsToString(field.options),
    allowUserCreatedOptions: field.allowUserCreatedOptions || false,
    appliesTo: field.appliesTo || ['Task', 'Bug', 'Suggestion'],
    showOnBoard: field.showOnBoard !== undefined ? field.showOnBoard : true,
    showInList: field.showInList !== undefined ? field.showInList : true,
    order: field.order || 0
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAppliesToChange = (taskType) => {
    setFormData(prev => {
      const newAppliesTo = prev.appliesTo.includes(taskType)
        ? prev.appliesTo.filter(t => t !== taskType)
        : [...prev.appliesTo, taskType];
      // Ensure at least one type is selected
      if (newAppliesTo.length === 0) return prev;
      return { ...prev, appliesTo: newAppliesTo };
    });
  };

  // Convert comma-separated text to options array
  const parseOptions = (text) => {
    if (!text || !text.trim()) return [];
    return text
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((value, index) => ({ value, order: index }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Field name is required');
      return;
    }
    onSave({
      ...field,
      name: formData.name.trim(),
      options: parseOptions(formData.optionsText),
      allowUserCreatedOptions: formData.allowUserCreatedOptions,
      appliesTo: formData.appliesTo,
      showOnBoard: formData.showOnBoard,
      showInList: formData.showInList,
      order: formData.order
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="custom-field-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? 'New Custom Field' : 'Edit Custom Field'}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Field Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              maxLength={100}
              placeholder="e.g., Priority Level, Component, Sprint"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="optionsText">Options</label>
            <input
              type="text"
              id="optionsText"
              name="optionsText"
              value={formData.optionsText}
              onChange={handleChange}
              placeholder="Enter options separated by commas (e.g., Option 1, Option 2, Option 3)"
            />
            <p className="field-help">
              Separate options with commas. The order you enter them is the order they will appear.
            </p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="allowUserCreatedOptions"
                checked={formData.allowUserCreatedOptions}
                onChange={handleChange}
              />
              <span>Allow users to add their own options</span>
            </label>
            <p className="field-help">
              When enabled, users can type any value. When disabled, they must choose from the predefined options.
            </p>
          </div>

          <div className="form-group">
            <label>Applies to Task Types</label>
            <div className="checkbox-group">
              {TASK_TYPES.map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.appliesTo.includes(type)}
                    onChange={() => handleAppliesToChange(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Display Options</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="showOnBoard"
                  checked={formData.showOnBoard}
                  onChange={handleChange}
                />
                <span>Show on board (task cards)</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="showInList"
                  checked={formData.showInList}
                  onChange={handleChange}
                />
                <span>Show in list view</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isNew ? 'Create Field' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

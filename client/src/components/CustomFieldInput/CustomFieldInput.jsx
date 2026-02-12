import { useEffect, useMemo } from 'react';
import './CustomFieldInput.css';

export default function CustomFieldInput({ field, value, onChange }) {
  // Get sorted options - memoize to prevent unnecessary re-renders
  const sortedOptions = useMemo(() =>
    [...(field.options || [])].sort((a, b) => a.order - b.order),
    [field.options]
  );

  // Get the default value for non-user-created fields
  const defaultValue = useMemo(() =>
    !field.allowUserCreatedOptions && sortedOptions.length > 0 ? sortedOptions[0].value : null,
    [field.allowUserCreatedOptions, sortedOptions]
  );

  // For non-user-created fields, default to first option if no value
  useEffect(() => {
    if (defaultValue && !value) {
      onChange(field._id, defaultValue);
    }
  }, [field._id, defaultValue, value, onChange]);

  const handleChange = (e) => {
    onChange(field._id, e.target.value);
  };

  // When allowUserCreatedOptions is true, render input with datalist
  if (field.allowUserCreatedOptions) {
    const datalistId = `field-datalist-${field._id}`;
    return (
      <div className="custom-field-input">
        <label htmlFor={`field-${field._id}`}>{field.name}</label>
        <input
          type="text"
          id={`field-${field._id}`}
          list={datalistId}
          value={value || ''}
          onChange={handleChange}
          placeholder={`Enter ${field.name.toLowerCase()}...`}
        />
        {sortedOptions.length > 0 && (
          <datalist id={datalistId}>
            {sortedOptions.map((option, idx) => (
              <option key={idx} value={option.value} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  // When allowUserCreatedOptions is false, render select dropdown
  // Default value is already set via useEffect, so no empty option needed
  return (
    <div className="custom-field-input">
      <label htmlFor={`field-${field._id}`}>{field.name}</label>
      <select
        id={`field-${field._id}`}
        value={value || defaultValue || ''}
        onChange={handleChange}
      >
        {sortedOptions.map((option, idx) => (
          <option key={idx} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
    </div>
  );
}

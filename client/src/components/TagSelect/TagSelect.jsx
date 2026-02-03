import { useState, useRef, useEffect, useMemo } from 'react';
import './TagSelect.css';

export default function TagSelect({
  value,
  onChange,
  allTags = [],
  placeholder = 'Enter tags separated by commas',
  id,
  name
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync input with external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Parse current tags from input value
  const currentTags = useMemo(() => {
    return inputValue
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  }, [inputValue]);

  // Filter out tags that are already in the input
  const availableTags = useMemo(() => {
    return allTags.filter(tag => !currentTags.includes(tag.toLowerCase()));
  }, [allTags, currentTags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange({ target: { name, value: newValue } });
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectTag = (tag) => {
    // Append tag to existing value
    let newValue;
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      newValue = tag;
    } else if (trimmedInput.endsWith(',')) {
      newValue = trimmedInput + ' ' + tag;
    } else {
      newValue = trimmedInput + ', ' + tag;
    }

    setInputValue(newValue);
    onChange({ target: { name, value: newValue } });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="tag-select" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && availableTags.length > 0 && (
        <div className="tag-select-dropdown">
          {availableTags.map(tag => (
            <div
              key={tag}
              className="tag-select-option"
              onClick={() => handleSelectTag(tag)}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

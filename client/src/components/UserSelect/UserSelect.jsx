import { useState, useRef, useEffect } from 'react';
import './UserSelect.css';

export default function UserSelect({
  value,
  onChange,
  users = [],
  placeholder = 'Select or type a name...',
  id,
  name
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [filteredUsers, setFilteredUsers] = useState(users);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync input with external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter users based on input
  useEffect(() => {
    let filtered;
    if (!inputValue) {
      filtered = users;
    } else {
      const searchLower = inputValue.toLowerCase();
      filtered = users.filter(user =>
        user.name.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    }
    setFilteredUsers(filtered);
  }, [inputValue, users]);

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
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Show all users when focusing, regardless of current value
    setFilteredUsers(users);
  };

  const handleSelectUser = (user) => {
    setInputValue(user.name);
    onChange({ target: { name, value: user.name } });
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Enter' && filteredUsers.length > 0) {
      e.preventDefault();
      handleSelectUser(filteredUsers[0]);
    }
  };

  return (
    <div className="user-select" ref={wrapperRef}>
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
      {isOpen && filteredUsers.length > 0 && (
        <div className="user-select-dropdown">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className="user-select-option"
              onClick={() => handleSelectUser(user)}
            >
              <span className="user-select-name">{user.name}</span>
              {user.email && (
                <span className="user-select-email">{user.email}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

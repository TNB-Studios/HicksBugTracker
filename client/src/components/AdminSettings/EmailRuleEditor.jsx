import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ConditionBuilder from './ConditionBuilder';
import UserSelect from '../UserSelect/UserSelect';
import './EmailRuleEditor.css';

const TRIGGER_TYPES = [
  { value: 'state_change', label: 'State/Column Changes' },
  { value: 'assignee_change', label: 'Assignee Changes' },
  { value: 'comment_added', label: 'Comment Added' },
  { value: 'comment_edited', label: 'Comment Text Edited' }
];

const RECIPIENT_TYPES = [
  { value: 'assignee', label: 'Task Assignee' },
  { value: 'reporter', label: 'Task Reporter/Creator' },
  { value: 'specific', label: 'Specific User' }
];

const TEMPLATE_VARIABLES = [
  { var: '{{task.name}}', desc: 'Task name' },
  { var: '{{task.description}}', desc: 'Task description' },
  { var: '{{task.state}}', desc: 'Current state/column' },
  { var: '{{task.priority}}', desc: 'Priority level' },
  { var: '{{task.type}}', desc: 'Task type (Task/Bug/Suggestion)' },
  { var: '{{task.assignee}}', desc: 'Current assignee' },
  { var: '{{task.reporter}}', desc: 'Reporter/creator' },
  { var: '{{task.url}}', desc: 'Link to task' },
  { var: '{{previous.state}}', desc: 'Previous state (for state changes)' },
  { var: '{{previous.assignee}}', desc: 'Previous assignee (for assignee changes)' },
  { var: '{{comment.text}}', desc: 'Comment text (for comment triggers)' },
  { var: '{{comment.author}}', desc: 'Comment author (for comment triggers)' },
  { var: '{{board.name}}', desc: 'Board name' }
];

export default function EmailRuleEditor({ rule, boardId, isNew, onSave, onCancel }) {
  const { boardUsers, columns } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    trigger: { type: 'state_change' },
    conditions: { logic: 'AND', rules: [] },
    email: {
      recipientType: 'assignee',
      specificUserId: null,
      specificEmail: '',
      specificName: '',
      subject: '',
      body: ''
    }
  });

  const [errors, setErrors] = useState({});
  const [showVariables, setShowVariables] = useState(false);

  useEffect(() => {
    if (rule) {
      setFormData({
        ...rule,
        conditions: rule.conditions || { logic: 'AND', rules: [] },
        email: rule.email || {
          recipientType: 'assignee',
          specificUserId: null,
          specificEmail: '',
          specificName: '',
          subject: '',
          body: ''
        }
      });
    }
  }, [rule]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleTriggerChange = (type) => {
    setFormData(prev => ({
      ...prev,
      trigger: { type }
    }));
  };

  const handleEmailChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      email: { ...prev.email, [field]: value }
    }));
    setErrors(prev => ({ ...prev, [`email.${field}`]: null }));
  };

  const handleSpecificUserChange = (e) => {
    const userName = e.target.value;
    const user = boardUsers.find(u => u.name === userName);
    setFormData(prev => ({
      ...prev,
      email: {
        ...prev.email,
        specificName: userName,
        specificEmail: user?.email || '',
        specificUserId: user?.id || null
      }
    }));
  };

  const handleConditionsChange = (conditions) => {
    setFormData(prev => ({ ...prev, conditions }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!formData.email.subject.trim()) {
      newErrors['email.subject'] = 'Email subject is required';
    }

    if (!formData.email.body.trim()) {
      newErrors['email.body'] = 'Email body is required';
    }

    if (formData.email.recipientType === 'specific' && !formData.email.specificEmail) {
      newErrors['email.specificEmail'] = 'Please select a user';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...formData,
        boardId
      });
    }
  };

  const insertVariable = (variable) => {
    // Insert at cursor position in body field
    const bodyField = document.getElementById('rule-email-body');
    if (bodyField) {
      const start = bodyField.selectionStart;
      const end = bodyField.selectionEnd;
      const currentValue = formData.email.body;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      handleEmailChange('body', newValue);
      // Reset cursor position after React updates
      setTimeout(() => {
        bodyField.focus();
        bodyField.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="email-rule-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? 'Create Email Rule' : 'Edit Email Rule'}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="editor-content">
            {/* Rule Name */}
            <div className="form-group">
              <label htmlFor="rule-name">Rule Name *</label>
              <input
                type="text"
                id="rule-name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g., Notify assignee on state change"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {/* Trigger Type */}
            <div className="form-group">
              <label>Trigger Event *</label>
              <div className="trigger-options">
                {TRIGGER_TYPES.map(trigger => (
                  <label key={trigger.value} className="radio-option">
                    <input
                      type="radio"
                      name="trigger-type"
                      value={trigger.value}
                      checked={formData.trigger.type === trigger.value}
                      onChange={() => handleTriggerChange(trigger.value)}
                    />
                    <span>{trigger.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div className="form-group">
              <label>Conditions (Optional)</label>
              <p className="form-hint">Add conditions to filter when this rule should trigger.</p>
              <ConditionBuilder
                conditions={formData.conditions}
                onChange={handleConditionsChange}
                triggerType={formData.trigger.type}
                columns={columns}
              />
            </div>

            {/* Email Recipient */}
            <div className="form-group">
              <label>Email Recipient *</label>
              <div className="recipient-selector">
                <select
                  value={formData.email.recipientType}
                  onChange={e => handleEmailChange('recipientType', e.target.value)}
                >
                  {RECIPIENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {formData.email.recipientType === 'specific' && (
                  <div className="specific-user-select">
                    <UserSelect
                      value={formData.email.specificName}
                      onChange={handleSpecificUserChange}
                      users={boardUsers}
                      placeholder="Select user..."
                    />
                    {formData.email.specificEmail && (
                      <span className="selected-email">{formData.email.specificEmail}</span>
                    )}
                    {errors['email.specificEmail'] && (
                      <span className="error-text">{errors['email.specificEmail']}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Email Subject */}
            <div className="form-group">
              <label htmlFor="rule-email-subject">Email Subject *</label>
              <input
                type="text"
                id="rule-email-subject"
                value={formData.email.subject}
                onChange={e => handleEmailChange('subject', e.target.value)}
                placeholder="e.g., Task {{task.name}} has been updated"
                className={errors['email.subject'] ? 'error' : ''}
              />
              {errors['email.subject'] && <span className="error-text">{errors['email.subject']}</span>}
            </div>

            {/* Email Body */}
            <div className="form-group">
              <div className="label-with-action">
                <label htmlFor="rule-email-body">Email Body *</label>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => setShowVariables(!showVariables)}
                >
                  {showVariables ? 'Hide Variables' : 'Show Variables'}
                </button>
              </div>
              {showVariables && (
                <div className="variables-panel">
                  <p>Click a variable to insert it into the email body:</p>
                  <div className="variables-list">
                    {TEMPLATE_VARIABLES.map(v => (
                      <button
                        key={v.var}
                        type="button"
                        className="variable-chip"
                        onClick={() => insertVariable(v.var)}
                        title={v.desc}
                      >
                        {v.var}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                id="rule-email-body"
                value={formData.email.body}
                onChange={e => handleEmailChange('body', e.target.value)}
                placeholder="Enter the email body content. You can use template variables like {{task.name}}."
                rows={6}
                className={errors['email.body'] ? 'error' : ''}
              />
              {errors['email.body'] && <span className="error-text">{errors['email.body']}</span>}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formData.name.trim().length < 6}
            >
              {isNew ? 'Create Rule' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

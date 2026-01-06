import './ConditionBuilder.css';

const CONDITION_FIELDS = [
  { value: 'fromState', label: 'From State', forTriggers: ['state_change'] },
  { value: 'toState', label: 'To State', forTriggers: ['state_change'] },
  { value: 'priority', label: 'Priority', forTriggers: ['state_change', 'assignee_change', 'comment_added', 'comment_edited'] },
  { value: 'taskType', label: 'Task Type', forTriggers: ['state_change', 'assignee_change', 'comment_added', 'comment_edited'] },
  { value: 'assignee', label: 'Assignee', forTriggers: ['state_change', 'comment_added', 'comment_edited'] },
  { value: 'reporter', label: 'Reporter', forTriggers: ['state_change', 'assignee_change', 'comment_added', 'comment_edited'] },
  { value: 'newAssignee', label: 'New Assignee', forTriggers: ['assignee_change'] },
  { value: 'previousAssignee', label: 'Previous Assignee', forTriggers: ['assignee_change'] }
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' }
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TASK_TYPES = ['Task', 'Bug', 'Suggestion'];

export default function ConditionBuilder({ conditions, onChange, triggerType, columns }) {
  // Filter fields based on trigger type
  const availableFields = CONDITION_FIELDS.filter(
    f => f.forTriggers.includes(triggerType)
  );

  const handleLogicChange = (logic) => {
    onChange({ ...conditions, logic });
  };

  const handleAddCondition = () => {
    const defaultField = availableFields[0]?.value || 'priority';
    onChange({
      ...conditions,
      rules: [
        ...conditions.rules,
        { field: defaultField, operator: 'equals', value: '' }
      ]
    });
  };

  const handleRemoveCondition = (index) => {
    onChange({
      ...conditions,
      rules: conditions.rules.filter((_, i) => i !== index)
    });
  };

  const handleConditionChange = (index, field, value) => {
    const newRules = [...conditions.rules];
    newRules[index] = { ...newRules[index], [field]: value };

    // Clear value when switching to is_empty/is_not_empty operators
    if (field === 'operator' && (value === 'is_empty' || value === 'is_not_empty')) {
      newRules[index].value = '';
    }

    onChange({ ...conditions, rules: newRules });
  };

  const getValueInput = (rule, index) => {
    // No value input needed for empty checks
    if (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') {
      return null;
    }

    // State fields use column names
    if (rule.field === 'fromState' || rule.field === 'toState') {
      return (
        <select
          value={rule.value}
          onChange={e => handleConditionChange(index, 'value', e.target.value)}
        >
          <option value="">Select state...</option>
          {columns.map(col => (
            <option key={col._id} value={col.name}>{col.name}</option>
          ))}
        </select>
      );
    }

    // Priority dropdown
    if (rule.field === 'priority') {
      return (
        <select
          value={rule.value}
          onChange={e => handleConditionChange(index, 'value', e.target.value)}
        >
          <option value="">Select priority...</option>
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      );
    }

    // Task type dropdown
    if (rule.field === 'taskType') {
      return (
        <select
          value={rule.value}
          onChange={e => handleConditionChange(index, 'value', e.target.value)}
        >
          <option value="">Select type...</option>
          {TASK_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={rule.value}
        onChange={e => handleConditionChange(index, 'value', e.target.value)}
        placeholder="Enter value..."
      />
    );
  };

  return (
    <div className="condition-builder">
      {conditions.rules.length > 0 && (
        <div className="logic-selector">
          <span>Match</span>
          <select
            value={conditions.logic}
            onChange={e => handleLogicChange(e.target.value)}
          >
            <option value="AND">ALL conditions (AND)</option>
            <option value="OR">ANY condition (OR)</option>
          </select>
        </div>
      )}

      <div className="conditions-list">
        {conditions.rules.map((rule, index) => (
          <div key={index} className="condition-row">
            <select
              value={rule.field}
              onChange={e => handleConditionChange(index, 'field', e.target.value)}
              className="condition-field"
            >
              {availableFields.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <select
              value={rule.operator}
              onChange={e => handleConditionChange(index, 'operator', e.target.value)}
              className="condition-operator"
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            <div className="condition-value">
              {getValueInput(rule, index)}
            </div>

            <button
              type="button"
              className="condition-remove"
              onClick={() => handleRemoveCondition(index)}
              title="Remove condition"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-small btn-secondary add-condition-btn"
        onClick={handleAddCondition}
      >
        + Add Condition
      </button>
    </div>
  );
}

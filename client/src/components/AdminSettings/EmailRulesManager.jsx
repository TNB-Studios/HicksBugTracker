import { useState, useEffect } from 'react';
import { emailRuleApi } from '../../services/api';
import EmailRuleEditor from './EmailRuleEditor';
import './EmailRulesManager.css';

const createEmptyRule = () => ({
  name: '',
  enabled: true,
  trigger: {
    type: 'state_change'
  },
  conditions: {
    logic: 'AND',
    rules: []
  },
  email: {
    recipientType: 'assignee',
    specificUserId: null,
    specificEmail: '',
    specificName: '',
    subject: '',
    body: ''
  }
});

export default function EmailRulesManager({ boards }) {
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?._id || '');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch rules from API when selectedBoardId changes
  useEffect(() => {
    if (selectedBoardId) {
      fetchRules();
    }
  }, [selectedBoardId]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await emailRuleApi.getAll(selectedBoardId);
      setRules(response.data.data || []);
    } catch (err) {
      console.error('Error fetching email rules:', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    setEditingRule(createEmptyRule());
    setIsCreating(true);
  };

  const handleEditRule = (rule) => {
    setEditingRule({ ...rule });
    setIsCreating(false);
  };

  const handleDuplicateRule = async (rule) => {
    try {
      await emailRuleApi.duplicate(selectedBoardId, rule._id);
      await fetchRules();
    } catch (err) {
      alert('Error duplicating rule: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      try {
        await emailRuleApi.delete(selectedBoardId, ruleId);
        setRules(prev => prev.filter(r => r._id !== ruleId));
      } catch (err) {
        alert('Error deleting rule: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const response = await emailRuleApi.toggle(selectedBoardId, ruleId);
      const updatedRule = response.data.data;
      setRules(prev => prev.map(r => r._id === ruleId ? updatedRule : r));
    } catch (err) {
      alert('Error toggling rule: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveRule = async (rule) => {
    try {
      if (isCreating) {
        const response = await emailRuleApi.create(selectedBoardId, rule);
        setRules(prev => [response.data.data, ...prev]);
      } else {
        const response = await emailRuleApi.update(selectedBoardId, rule._id, rule);
        setRules(prev => prev.map(r => r._id === rule._id ? response.data.data : r));
      }
      setEditingRule(null);
    } catch (err) {
      alert('Error saving rule: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
  };

  const getTriggerLabel = (trigger) => {
    switch (trigger.type) {
      case 'state_change': return 'State Changes';
      case 'assignee_change': return 'Assignee Changes';
      case 'comment_added': return 'Comment Added';
      case 'comment_edited': return 'Comment Edited';
      default: return trigger.type;
    }
  };

  const getRecipientLabel = (email) => {
    switch (email.recipientType) {
      case 'assignee': return 'Task Assignee';
      case 'reporter': return 'Task Reporter';
      case 'specific': return email.specificName || email.specificEmail || 'Specific User';
      default: return email.recipientType;
    }
  };

  const selectedBoard = boards.find(b => b._id === selectedBoardId);

  return (
    <div className="email-rules-manager">
      <div className="email-rules-header">
        <div className="board-selector">
          <label htmlFor="rule-board-select">Board:</label>
          <select
            id="rule-board-select"
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
          >
            {boards.map(board => (
              <option key={board._id} value={board._id}>{board.name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleAddRule}>
          + Add Rule
        </button>
      </div>

      {loading ? (
        <div className="loading-rules">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="no-rules">
          <p>No email notification rules defined for "{selectedBoard?.name}".</p>
          <p>Click "Add Rule" to create your first rule.</p>
        </div>
      ) : (
        <div className="rules-list">
          {rules.map(rule => (
            <div key={rule._id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
              <div className="rule-header">
                <label className="rule-toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule._id)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="rule-name">{rule.name}</span>
                <div className="rule-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => handleEditRule(rule)}
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => handleDuplicateRule(rule)}
                    title="Duplicate"
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteRule(rule._id)}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="rule-summary">
                <span className="rule-trigger">
                  <strong>When:</strong> {getTriggerLabel(rule.trigger)}
                </span>
                <span className="rule-recipient">
                  <strong>Email:</strong> {getRecipientLabel(rule.email)}
                </span>
                {rule.conditions.rules.length > 0 && (
                  <span className="rule-conditions">
                    <strong>Conditions:</strong> {rule.conditions.rules.length} condition(s)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingRule && (
        <EmailRuleEditor
          rule={editingRule}
          boardId={selectedBoardId}
          isNew={isCreating}
          onSave={handleSaveRule}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

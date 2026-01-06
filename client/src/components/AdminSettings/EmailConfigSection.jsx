import { useState, useEffect } from 'react';
import { emailConfigApi } from '../../services/api';

export default function EmailConfigSection() {
  const [config, setConfig] = useState({
    serviceAccountEmail: '',
    serviceAccountPrivateKey: '',
    sendAsEmail: '',
    fromName: 'Hicks Bug Hunt',
    enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await emailConfigApi.get();
      if (response.data.data) {
        setConfig(response.data.data);
        setOriginalConfig(response.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load email configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setConfig(prev => {
      const updated = { ...prev, [name]: newValue };
      // Check if there are changes
      if (originalConfig) {
        const changed = Object.keys(updated).some(key => {
          // Skip private key comparison if it's the masked value
          if (key === 'serviceAccountPrivateKey' && updated[key] === '••••••••') return false;
          return updated[key] !== originalConfig[key];
        });
        setHasChanges(changed || (updated.serviceAccountPrivateKey !== '••••••••' && updated.serviceAccountPrivateKey !== originalConfig.serviceAccountPrivateKey));
      } else {
        setHasChanges(true);
      }
      return updated;
    });
  };

  const handleJsonUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.client_email && json.private_key) {
          setConfig(prev => ({
            ...prev,
            serviceAccountEmail: json.client_email,
            serviceAccountPrivateKey: json.private_key
          }));
          setHasChanges(true);
          setMessage({ type: 'success', text: 'Service account credentials loaded from JSON file' });
        } else {
          setMessage({ type: 'error', text: 'Invalid JSON file. Must contain client_email and private_key fields.' });
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to parse JSON file' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const handleSave = async () => {
    if (!config.serviceAccountEmail || !config.sendAsEmail) {
      setMessage({ type: 'error', text: 'Service account email and send-as email are required' });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const response = await emailConfigApi.update(config);
      setConfig(response.data.data);
      setOriginalConfig(response.data.data);
      setHasChanges(false);
      setMessage({ type: 'success', text: 'Email configuration saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test recipient email' });
      return;
    }

    try {
      setTesting(true);
      setMessage({ type: '', text: '' });
      const response = await emailConfigApi.test(testEmail);
      setMessage({ type: 'success', text: response.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to send test email' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading email configuration...</div>;
  }

  return (
    <div className="email-config-section">
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="setup-guide-toggle">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setShowSetupGuide(!showSetupGuide)}
        >
          {showSetupGuide ? 'Hide Setup Guide' : 'Show Setup Guide'}
        </button>
      </div>

      {showSetupGuide && (
        <div className="setup-guide">
          <h4>Google Workspace OAuth2 Setup Guide</h4>
          <ol>
            <li>
              <strong>Create a Google Cloud Project:</strong>
              <ul>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                <li>Create a new project or select an existing one</li>
              </ul>
            </li>
            <li>
              <strong>Enable Gmail API:</strong>
              <ul>
                <li>Go to APIs &amp; Services &gt; Library</li>
                <li>Search for "Gmail API" and enable it</li>
              </ul>
            </li>
            <li>
              <strong>Create a Service Account:</strong>
              <ul>
                <li>Go to APIs &amp; Services &gt; Credentials</li>
                <li>Click "Create Credentials" &gt; "Service Account"</li>
                <li>Give it a name (e.g., "Hicks Email Sender")</li>
                <li>Click "Done"</li>
              </ul>
            </li>
            <li>
              <strong>Create and Download Key:</strong>
              <ul>
                <li>Click on the service account you created</li>
                <li>Go to "Keys" tab</li>
                <li>Click "Add Key" &gt; "Create new key" &gt; "JSON"</li>
                <li>Save the downloaded JSON file</li>
              </ul>
            </li>
            <li>
              <strong>Enable Domain-Wide Delegation:</strong>
              <ul>
                <li>On the service account details page, click "Show Advanced Settings"</li>
                <li>Enable "Domain-wide Delegation"</li>
                <li>Copy the "Client ID" (you'll need it for the next step)</li>
              </ul>
            </li>
            <li>
              <strong>Authorize in Google Workspace Admin:</strong>
              <ul>
                <li>Go to <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer">Google Admin Console</a></li>
                <li>Go to Security &gt; Access and data control &gt; API controls</li>
                <li>Click "Manage Domain Wide Delegation"</li>
                <li>Click "Add new"</li>
                <li>Enter the Client ID from step 5</li>
                <li>Add this OAuth scope: <code>https://www.googleapis.com/auth/gmail.send</code></li>
                <li>Click "Authorize"</li>
              </ul>
            </li>
            <li>
              <strong>Upload the JSON file below</strong> to configure Hicks
            </li>
          </ol>
        </div>
      )}

      <div className="email-config-form">
        <div className="form-group">
          <label>Upload Service Account JSON Key</label>
          <input
            type="file"
            accept=".json"
            onChange={handleJsonUpload}
            className="file-input"
          />
          <small className="form-help">
            Upload the JSON key file downloaded from Google Cloud Console
          </small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="serviceAccountEmail">Service Account Email</label>
            <input
              type="email"
              id="serviceAccountEmail"
              name="serviceAccountEmail"
              value={config.serviceAccountEmail}
              onChange={handleChange}
              placeholder="service-account@project.iam.gserviceaccount.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sendAsEmail">Send As Email *</label>
            <input
              type="email"
              id="sendAsEmail"
              name="sendAsEmail"
              value={config.sendAsEmail}
              onChange={handleChange}
              placeholder="notifications@your-domain.com"
            />
            <small className="form-help">
              Must be a real user in your Workspace domain
            </small>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="serviceAccountPrivateKey">Private Key</label>
          <textarea
            id="serviceAccountPrivateKey"
            name="serviceAccountPrivateKey"
            value={config.serviceAccountPrivateKey}
            onChange={handleChange}
            placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            rows={4}
            className="private-key-input"
          />
          <small className="form-help">
            Usually auto-filled when uploading JSON. Keep as-is if already configured.
          </small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fromName">From Name</label>
            <input
              type="text"
              id="fromName"
              name="fromName"
              value={config.fromName}
              onChange={handleChange}
              placeholder="Hicks Bug Hunt"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="enabled"
                checked={config.enabled}
                onChange={handleChange}
              />
              Enable Email Sending
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        <div className="email-test-section">
          <h4>Test Email Configuration</h4>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="testEmail">Test Recipient Email</label>
              <input
                type="email"
                id="testEmail"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing || !config.serviceAccountEmail}
            >
              {testing ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {config.lastUpdatedBy && (
          <div className="config-meta">
            <small>
              Last updated by: {config.lastUpdatedBy}
              {config.updatedAt && ` on ${new Date(config.updatedAt).toLocaleString()}`}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

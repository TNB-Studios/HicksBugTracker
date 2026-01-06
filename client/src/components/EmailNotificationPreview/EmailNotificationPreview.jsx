import './EmailNotificationPreview.css';

export default function EmailNotificationPreview({ notification, onDismiss }) {
  if (!notification) return null;

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="email-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Email Would Be Sent</h2>
        </div>

        <div className="email-preview-content">
          <p className="preview-note">
            Rule "{notification.ruleName}" triggered.
            {notification.allMatchingRules > 1 && (
              <span> ({notification.allMatchingRules} rules matched)</span>
            )}
          </p>

          <div className="email-field">
            <label>To:</label>
            <span>{notification.recipient.name} &lt;{notification.recipient.email}&gt;</span>
          </div>

          <div className="email-field">
            <label>Subject:</label>
            <span>{notification.subject}</span>
          </div>

          <div className="email-field email-body">
            <label>Body:</label>
            <pre>{notification.body}</pre>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

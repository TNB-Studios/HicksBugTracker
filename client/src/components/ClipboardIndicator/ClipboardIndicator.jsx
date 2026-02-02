import { useApp } from '../../context/AppContext';
import './ClipboardIndicator.css';

export default function ClipboardIndicator() {
  const { clipboard, clearClipboard } = useApp();

  if (!clipboard || !clipboard.tasks || clipboard.tasks.length === 0) return null;

  const { tasks, isCut } = clipboard;
  const count = tasks.length;
  const displayName = count === 1
    ? (tasks[0].name.length > 20 ? tasks[0].name.substring(0, 20) + '...' : tasks[0].name)
    : `${count} tasks`;

  return (
    <div className={`clipboard-indicator ${isCut ? 'cut' : 'copy'}`}>
      <span className="clipboard-icon">{isCut ? '✂️' : '📋'}</span>
      <span className="clipboard-text">
        {isCut ? 'Cut: ' : 'Copied: '}
        <strong>{displayName}</strong>
      </span>
      <button className="clipboard-clear" onClick={clearClipboard} title="Clear clipboard">
        &times;
      </button>
    </div>
  );
}

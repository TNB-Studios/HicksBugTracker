export default function DependencyDialog({ task, tasksToMove, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="dependency-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Dependency Warning</h3>
        <p>
          <strong>{task.name}</strong> depends on {tasksToMove.length === 1 ? 'a task' : 'tasks'} that {tasksToMove.length === 1 ? 'is' : 'are'} not in this column:
        </p>
        <ul className="dependency-list">
          {tasksToMove.map(t => (
            <li key={t._id}>
              <span className="dependency-task-type">[{t.taskType || 'Task'}]</span> {t.name}
            </li>
          ))}
        </ul>
        <p>Do you want to move {tasksToMove.length === 1 ? 'this task' : 'these tasks'} as well?</p>
        <div className="dependency-dialog-buttons">
          <button className="btn btn-secondary" onClick={onCancel}>
            No, Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Yes, Move All
          </button>
        </div>
      </div>
    </div>
  );
}

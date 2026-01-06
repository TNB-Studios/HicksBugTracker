import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function BoardSelector() {
  const { boards, currentBoard, setCurrentBoard, createBoard, deleteBoard, updateBoard, user } = useApp();
  const canAdminBoards = user?.permissions?.canAdminBoards || false;

  const [showCreate, setShowCreate] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;

    try {
      await createBoard(newBoardName.trim(), newBoardDescription.trim());
      setNewBoardName('');
      setNewBoardDescription('');
      setShowCreate(false);
    } catch (err) {
      alert('Error creating board: ' + err.message);
    }
  };

  const handleDeleteBoard = async () => {
    if (!currentBoard) return;

    if (window.confirm(`Delete board "${currentBoard.name}" and all its tasks? This cannot be undone.`)) {
      try {
        await deleteBoard(currentBoard._id);
      } catch (err) {
        alert('Error deleting board: ' + err.message);
      }
    }
  };

  const handleRenameBoard = async () => {
    if (!editName.trim() || editName === currentBoard.name) {
      setIsEditing(false);
      return;
    }

    try {
      await updateBoard(currentBoard._id, { name: editName.trim() });
      setIsEditing(false);
    } catch (err) {
      alert('Error renaming board: ' + err.message);
    }
  };

  const startEditing = () => {
    setEditName(currentBoard?.name || '');
    setIsEditing(true);
  };

  return (
    <div className="board-selector">
      <div className="board-selector-main">
        <select
          value={currentBoard?._id || ''}
          onChange={(e) => {
            const selectedId = e.target.value;
            const board = boards.find(b => String(b._id) === selectedId);
            if (board) {
              setCurrentBoard(board);
            }
          }}
          className="board-dropdown"
        >
          {boards.length === 0 && (
            <option value="">No boards available</option>
          )}
          {boards.map(board => (
            <option key={board._id} value={board._id}>
              {board.name}
            </option>
          ))}
        </select>

        {canAdminBoards && (
          <button
            className="btn btn-icon"
            onClick={() => setShowCreate(!showCreate)}
            title="Create new board"
          >
            +
          </button>
        )}

        {currentBoard && canAdminBoards && (
          <>
            <button
              className="btn btn-icon"
              onClick={startEditing}
              title="Rename board"
            >
              ✎
            </button>
            <button
              className="btn btn-icon btn-danger"
              onClick={handleDeleteBoard}
              title="Delete board"
            >
              🗑
            </button>
          </>
        )}
      </div>

      {showCreate && (
        <div className="board-create-form">
          <input
            type="text"
            placeholder="Board name"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newBoardDescription}
            onChange={(e) => setNewBoardDescription(e.target.value)}
          />
          <div className="board-create-buttons">
            <button className="btn btn-primary" onClick={handleCreateBoard}>
              Create Board
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <h3>Rename Board</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameBoard()}
              autoFocus
            />
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRenameBoard}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

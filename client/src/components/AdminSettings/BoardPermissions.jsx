import { useState } from 'react';
import { userApi } from '../../services/api';

export default function BoardPermissions({ user, boards, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [draggedBoard, setDraggedBoard] = useState(null);

  const allowedBoards = user.permissions.allowedBoards || [];
  const disallowedBoards = boards.filter(b => !allowedBoards.includes(b._id));
  const allowedBoardsList = boards.filter(b => allowedBoards.includes(b._id));

  const handleDragStart = (e, boardId) => {
    setDraggedBoard(boardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToAllowed = async (e) => {
    e.preventDefault();
    if (!draggedBoard || allowedBoards.includes(draggedBoard)) return;

    const newAllowedBoards = [...allowedBoards, draggedBoard];
    await saveBoards(newAllowedBoards);
    setDraggedBoard(null);
  };

  const handleDropToDisallowed = async (e) => {
    e.preventDefault();
    if (!draggedBoard || !allowedBoards.includes(draggedBoard)) return;

    const newAllowedBoards = allowedBoards.filter(id => id !== draggedBoard);
    await saveBoards(newAllowedBoards);
    setDraggedBoard(null);
  };

  const saveBoards = async (newAllowedBoards) => {
    setSaving(true);
    try {
      await userApi.updateAllowedBoards(user.id, newAllowedBoards);
      onUpdate(user.id, newAllowedBoards);
    } catch (err) {
      console.error('Failed to update board permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  const getBoardName = (boardId) => {
    const board = boards.find(b => b._id === boardId);
    return board ? board.name : boardId;
  };

  return (
    <div className="board-permissions">
      <div className="board-permissions-columns">
        <div
          className="board-list disallowed"
          onDragOver={handleDragOver}
          onDrop={handleDropToDisallowed}
        >
          <h4>Disallowed</h4>
          <div className="board-list-items">
            {disallowedBoards.map(board => (
              <div
                key={board._id}
                className="board-item"
                draggable
                onDragStart={(e) => handleDragStart(e, board._id)}
              >
                {board.name}
              </div>
            ))}
            {disallowedBoards.length === 0 && (
              <div className="board-list-empty">No boards</div>
            )}
          </div>
        </div>

        <div
          className="board-list allowed"
          onDragOver={handleDragOver}
          onDrop={handleDropToAllowed}
        >
          <h4>Allowed</h4>
          <div className="board-list-items">
            {allowedBoardsList.map(board => (
              <div
                key={board._id}
                className="board-item"
                draggable
                onDragStart={(e) => handleDragStart(e, board._id)}
              >
                {board.name}
              </div>
            ))}
            {allowedBoardsList.length === 0 && (
              <div className="board-list-empty">No boards</div>
            )}
          </div>
        </div>
      </div>
      {saving && <div className="board-permissions-saving">Saving...</div>}
    </div>
  );
}

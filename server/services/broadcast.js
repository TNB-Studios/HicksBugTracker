// Server-Sent Events broadcast service for real-time updates

// Store connected clients: Map of boardId -> Set of response objects
const boardClients = new Map();

// Store all connected clients for global events
const allClients = new Set();

/**
 * Add a client connection for a specific board
 */
function addClient(res, boardId) {
  allClients.add(res);

  if (boardId) {
    if (!boardClients.has(boardId)) {
      boardClients.set(boardId, new Set());
    }
    boardClients.get(boardId).add(res);
  }

  // Remove client on disconnect
  res.on('close', () => {
    allClients.delete(res);
    if (boardId && boardClients.has(boardId)) {
      boardClients.get(boardId).delete(res);
      if (boardClients.get(boardId).size === 0) {
        boardClients.delete(boardId);
      }
    }
  });
}

/**
 * Broadcast an event to all clients watching a specific board
 * @param {string} boardId - The board ID to broadcast to
 * @param {string} eventType - Type of event (task_created, task_updated, etc.)
 * @param {object} data - Event data
 * @param {string} excludeUserId - Optional user ID to exclude (the one who made the change)
 */
function broadcastToBoard(boardId, eventType, data, excludeUserId = null) {
  const clients = boardClients.get(boardId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    type: eventType,
    boardId,
    data,
    timestamp: new Date().toISOString()
  });

  clients.forEach(client => {
    // Check if this client should be excluded
    if (excludeUserId && client.userId === excludeUserId) {
      return;
    }

    try {
      client.write(`data: ${message}\n\n`);
    } catch (err) {
      console.error('Error broadcasting to client:', err.message);
      // Remove failed client
      clients.delete(client);
      allClients.delete(client);
    }
  });
}

/**
 * Broadcast to all connected clients (for global events like board changes)
 */
function broadcastGlobal(eventType, data, excludeUserId = null) {
  const message = JSON.stringify({
    type: eventType,
    data,
    timestamp: new Date().toISOString()
  });

  allClients.forEach(client => {
    if (excludeUserId && client.userId === excludeUserId) {
      return;
    }

    try {
      client.write(`data: ${message}\n\n`);
    } catch (err) {
      console.error('Error broadcasting to client:', err.message);
      allClients.delete(client);
    }
  });
}

/**
 * Get stats about connected clients
 */
function getStats() {
  const boardStats = {};
  boardClients.forEach((clients, boardId) => {
    boardStats[boardId] = clients.size;
  });

  return {
    totalClients: allClients.size,
    boardClients: boardStats
  };
}

module.exports = {
  addClient,
  broadcastToBoard,
  broadcastGlobal,
  getStats
};

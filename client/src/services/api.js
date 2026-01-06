import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Board API
export const boardApi = {
  getAll: () => api.get('/boards'),
  getOne: (id) => api.get(`/boards/${id}`),
  create: (data) => api.post('/boards', data),
  update: (id, data) => api.put(`/boards/${id}`, data),
  delete: (id) => api.delete(`/boards/${id}`)
};

// Column API
export const columnApi = {
  getAll: (boardId) => api.get(`/boards/${boardId}/columns`),
  create: (boardId, data) => api.post(`/boards/${boardId}/columns`, data),
  update: (id, data) => api.put(`/columns/${id}`, data),
  delete: (id) => api.delete(`/columns/${id}`),
  reorder: (boardId, columnOrder) => api.put(`/boards/${boardId}/columns/reorder`, { columnOrder })
};

// Task API
export const taskApi = {
  getAll: (boardId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.state) params.append('state', filters.state);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return api.get(`/boards/${boardId}/tasks${queryString ? `?${queryString}` : ''}`);
  },
  getOne: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  move: (id, columnId, position) => api.put(`/tasks/${id}/move`, { columnId, position }),
  delete: (id) => api.delete(`/tasks/${id}`),
  addComment: (id, data) => api.post(`/tasks/${id}/comments`, data),
  deleteComment: (id, commentId) => api.delete(`/tasks/${id}/comments/${commentId}`)
};

// User API (admin only)
export const userApi = {
  getAll: () => api.get('/users'),
  updatePermissions: (id, permissions) => api.put(`/users/${id}/permissions`, permissions),
  updateAllowedBoards: (id, allowedBoards) => api.put(`/users/${id}/permissions`, { allowedBoards })
};

// File API
export const fileApi = {
  // Upload files to a board (returns file metadata)
  upload: (boardId, files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post(`/boards/${boardId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // Attach uploaded files to a task
  attachToTask: (taskId, files) => api.post(`/tasks/${taskId}/files`, { files }),
  // Remove a file from a task
  removeFromTask: (taskId, fileId) => api.delete(`/tasks/${taskId}/files/${fileId}`),
  // Attach uploaded files to a comment
  attachToComment: (taskId, commentId, files) =>
    api.post(`/tasks/${taskId}/comments/${commentId}/files`, { files }),
  // Remove a file from a comment
  removeFromComment: (taskId, commentId, fileId) =>
    api.delete(`/tasks/${taskId}/comments/${commentId}/files/${fileId}`),
  // Get file URL
  getUrl: (boardId, fileId) => `${API_BASE_URL}/boards/${boardId}/files/${fileId}`
};

export default api;

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
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

export default api;

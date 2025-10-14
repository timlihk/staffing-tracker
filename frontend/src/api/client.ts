import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Custom event for auth failures - allows App component to handle logout gracefully
export const AUTH_ERROR_EVENT = 'auth-error';

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Dispatch custom event instead of hard redirect
      // This allows the app to show a message and preserve navigation state
      window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT, {
        detail: { from: window.location.pathname }
      }));
    }
    return Promise.reject(error);
  }
);

export default apiClient;

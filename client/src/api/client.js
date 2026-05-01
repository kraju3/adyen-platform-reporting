import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.response.use(
  response => response,
  error => {
    if (import.meta.env.DEV) {
      console.error('[API Error]', error.response?.status, error.config?.url, error.message);
    }
    return Promise.reject(error);
  }
);

export default client;

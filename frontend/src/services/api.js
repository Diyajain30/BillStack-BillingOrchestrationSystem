import axios from 'axios';

export const backendApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const ocrApi = axios.create({
  baseURL: '/extract-bill',
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
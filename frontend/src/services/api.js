import axios from 'axios';

// Calls Spring Boot backend via Vite proxy (port 8080)
export const backendApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Calls FastAPI OCR service via Vite proxy (port 5000)
export const ocrApi = axios.create({
  baseURL: '/extract-bill',
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
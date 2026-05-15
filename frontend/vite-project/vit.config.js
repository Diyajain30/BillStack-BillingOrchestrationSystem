import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Ensure the 's' is here

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/chatbot': 'http://localhost:3000',
      '/medical-record': 'http://localhost:3000',
      '/hospital': {
        target: 'http://localhost:3000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/admin-hospital': {
        target: 'http://localhost:3000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/admin': {
        target: 'http://localhost:3000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/receptionist': {
        target: 'http://localhost:3000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/compile': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/compile/, '/api/compile')
      },
      '/status': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/status/, '/api/status')
      },
      '/set-key': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/set-key/, '/api/set-key')
      },
      '/samples': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/samples/, '/api/samples')
      },
    },
  },
})

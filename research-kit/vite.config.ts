import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Not 5173, so this viewer and the website's dev server can run side by side
  // without stealing each other's port.
  server: { port: 5174 },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /graphity-mao/; local dev stays at /
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/graphity-mao/' : '/',
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
}))

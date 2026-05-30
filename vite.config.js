import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building for GitHub Pages the app is served from /camp-map-builder/.
// In dev (and any other host) it's served from the root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/camp-map-builder/' : '/',
}))

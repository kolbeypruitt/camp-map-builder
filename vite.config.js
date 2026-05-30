import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is configurable so the same code deploys anywhere:
//   - Root hosts (Vercel, Netlify, local dev/preview) -> "/"
//   - GitHub Pages project site -> "/camp-map-builder/" (set via BASE_PATH
//     in the Pages workflow).
export default defineConfig(() => ({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
}))

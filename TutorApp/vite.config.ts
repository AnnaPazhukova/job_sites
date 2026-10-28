import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Public base path. Hosts that serve from the domain root (Netlify, Vercel,
// custom domains) use the default "/". The GitHub Pages workflow sets
// GH_PAGES=true because it serves from https://<user>.github.io/job_sites/.
// Any other subpath can be set explicitly via VITE_BASE (e.g. "/app/").
// https://vite.dev/config/
export default defineConfig({
  base:
    process.env.VITE_BASE ??
    (process.env.GH_PAGES === 'true' ? '/job_sites/' : '/'),
  plugins: [react(), tailwindcss()],
})

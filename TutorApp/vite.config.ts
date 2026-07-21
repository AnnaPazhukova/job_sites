import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GH_PAGES=true is set by the GitHub Pages deploy workflow, since the site
// is served from https://<user>.github.io/job_sites/ (a subpath), not the
// domain root. Local dev/build stays at "/".
// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES === 'true' ? '/job_sites/' : '/',
  plugins: [react(), tailwindcss()],
})

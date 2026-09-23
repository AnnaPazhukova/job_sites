import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import { initSentry, Sentry } from './lib/sentry.ts'

initSentry()

// Every code-split route (ScheduleView, NotesView, ...) is a separate JS
// file named with a content hash, fetched on demand the first time a tab
// navigates there. Each new deploy replaces those files with freshly
// hashed ones — so a tab that's been open since before a deploy still has
// the *old* index.html in memory, and its first visit to a not-yet-loaded
// route asks for a chunk URL that no longer exists on the server. Vite
// fires this event for exactly that case; a one-time reload picks up the
// new index.html and fixes it, same as a manual refresh would. Guarded by
// sessionStorage so a genuine, unrelated failure (e.g. actually offline)
// doesn't reload forever.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const key = 'reloaded-after-preload-error'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})

function CrashFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-4">
      <div className="max-w-sm text-center">
        <div className="text-lg font-bold mb-2">Что-то пошло не так</div>
        <div className="text-sm text-gray-500 mb-5">
          Страница столкнулась с ошибкой и не может продолжить работу. Ваши данные не пострадали — просто обновите страницу.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition"
        >
          Обновить страницу
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <AuthGate />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

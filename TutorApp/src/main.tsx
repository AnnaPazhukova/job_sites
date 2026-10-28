import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import { initSentry, Sentry } from './lib/sentry.ts'
import { reloadOnce } from './lib/reloadOnce.ts'

initSentry()

// Code-split routes are hashed JS files replaced on every deploy, so a tab
// opened before a deploy can ask for a chunk that no longer exists; a reload
// picks up the fresh index.html. Vite's own signal for this fires when a
// chunk request itself fails (404, network error).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce('reloaded-after-preload-error')
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
    <Sentry.ErrorBoundary
      fallback={<CrashFallback />}
      onError={(error) => {
        // The other shape a stale chunk reference fails in: the dynamic
        // import resolves to undefined instead of rejecting (so
        // vite:preloadError above never fires), and React.lazy's own
        // internal `._result.default` lookup throws this exact TypeError. Seen in
        // production right after a deploy, same as the preload-error case.
        // Each JS engine phrases it differently — V8/Chrome says "Cannot read
        // properties of undefined (reading 'default')", JSC/Safari says
        // "undefined is not an object (evaluating 'e._result.default')" (seen
        // in production, Sentry issue JAVASCRIPT-REACT-H) — so this matches
        // on React's own internal property name (`_result.default`, a dotted
        // property access that minifiers don't rename) rather than either
        // engine's specific wording, to catch both.
        if (error instanceof TypeError && /reading '?default'?|_result\.default/.test(error.message)) {
          reloadOnce('reloaded-after-lazy-default-error')
        }
      }}
    >
      <AuthGate />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

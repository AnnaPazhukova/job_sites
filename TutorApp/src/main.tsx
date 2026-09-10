import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import { initSentry, Sentry } from './lib/sentry.ts'

initSentry()

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

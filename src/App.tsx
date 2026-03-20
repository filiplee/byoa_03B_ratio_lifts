import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import FormApp from './pages/FormApp'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { RetestBanner } from './components/RetestBanner'
import { useRetestState, updateRetestRecord } from './hooks/useRetestState'

function AppRoutes() {
  const location = useLocation()
  const retestState = useRetestState()

  const isRetestReady = retestState.status === 'ready'

  return (
    <>
      {location.pathname === '/' && isRetestReady && <RetestBanner state={retestState} />}
      <Routes>
        <Route
          path="/"
          element={<FormApp onRetestReportGenerated={isRetestReady ? () => updateRetestRecord({ bannerConsumedAt: Date.now() }) : undefined} />}
        />
        <Route path="/why" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}


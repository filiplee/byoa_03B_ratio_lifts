import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import FormApp from './pages/FormApp'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FormApp />} />
        <Route path="/why" element={<LandingPage />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}


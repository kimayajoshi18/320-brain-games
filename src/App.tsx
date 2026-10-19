import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppStateProvider from './state/AppStateProvider.tsx'
import ComingSoon from './screens/ComingSoon.tsx'

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ComingSoon name="Landing" />} />
          <Route path="/onboarding" element={<ComingSoon name="Onboarding" />} />
          <Route path="/home" element={<ComingSoon name="Today" />} />
          <Route path="/play/:gameId" element={<ComingSoon name="Game" />} />
          <Route path="/results" element={<ComingSoon name="Results" />} />
          <Route path="/profile" element={<ComingSoon name="Profile" />} />
          <Route path="/friends" element={<ComingSoon name="Friends" />} />
          <Route path="/path" element={<ComingSoon name="Learning path" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}

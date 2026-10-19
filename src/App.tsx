import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppStateProvider from './state/AppStateProvider.tsx'
import ComingSoon from './screens/ComingSoon.tsx'
import Friends from './screens/Friends.tsx'
import Home from './screens/Home.tsx'
import Landing from './screens/Landing.tsx'
import Onboarding from './screens/Onboarding.tsx'
import Play from './screens/Play.tsx'
import Profile from './screens/Profile.tsx'
import Results from './screens/Results.tsx'

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/home" element={<Home />} />
          <Route path="/play/:gameId" element={<Play />} />
          <Route path="/results" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/path" element={<ComingSoon name="Learning path" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}

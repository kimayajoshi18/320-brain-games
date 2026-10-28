import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Global styles first so screen styles can override the shared primitives.
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

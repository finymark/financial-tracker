import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import QuickAddApp from './QuickAddApp'
import { rendererView } from './lib/view-routing'
import './style.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing React root element')

createRoot(root).render(
  <StrictMode>
    {rendererView(window.location.search) === 'quick-add' ? (
      <QuickAddApp />
    ) : (
      <App />
    )}
  </StrictMode>,
)

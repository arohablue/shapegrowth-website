import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// Outside <App> rather than inside it: the scene canvas is keyed on the theme
// (see App.tsx), so the provider has to sit above everything that reads it.
createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode removed to prevent double-invocation of effects in development
createRoot(document.getElementById('root')).render(<App />)

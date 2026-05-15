import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Ensure this matches your filename exactly
import './index.css' // If you don't have this file, create an empty one or comment this line out

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
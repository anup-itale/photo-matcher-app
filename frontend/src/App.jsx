import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HostUpload from './components/HostUpload'
import UserView from './components/UserView'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HostUpload />} />
          <Route path="/session/:sessionId" element={<UserView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

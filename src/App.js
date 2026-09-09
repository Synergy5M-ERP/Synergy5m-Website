import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-next';
import NewLandingPage from './NewLandingPage';
import AdminPanel from './AdminPanel';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<NewLandingPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NewLandingPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
import React from 'react';
import ERPLandingPage from './ERPLandingPage';
import { HelmetProvider } from 'react-helmet-async';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <div className="App">
        <ERPLandingPage />
      </div>
    </HelmetProvider>
  );
}

export default App;
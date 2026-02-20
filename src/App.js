import React from 'react';
import ERPLandingPage from './ERPLandingPage';
import { HelmetProvider } from 'react-helmet-next';

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
import React from 'react';
import NewLandingPage from './NewLandingPage';
import { HelmetProvider } from 'react-helmet-next';

import './App.css';

function App() {
  return (
    <HelmetProvider>
      <div className="App">
        <NewLandingPage />
      </div>
    </HelmetProvider>
  );
}

export default App;
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './features/auth/AuthContext';
import { HealthProvider } from './features/health/HealthContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <HealthProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HealthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// src/main.tsx (NOWA WERSJA)

import React from 'react';
import ReactDOM from 'react-dom/client';
// Używamy komponentu App, który już zawiera AuthProvider i Router.
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
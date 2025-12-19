import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeDB } from './services/db';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  // Initialize mock DB on load
  initializeDB();
} catch (error) {
  console.error("Failed to initialize DB:", error);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
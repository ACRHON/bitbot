import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Update page title based on environment
const envTitle = import.meta.env.VITE_APP_TITLE;
if (envTitle) {
  document.title = envTitle;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

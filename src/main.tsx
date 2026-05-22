import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Handle redirect from 404.html for GitHub Pages SPA routing
const redirect = sessionStorage.redirect;
delete sessionStorage.redirect;
if (redirect && redirect !== location.href) {
  history.replaceState(null, '', redirect);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

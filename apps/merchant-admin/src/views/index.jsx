import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import '../styles/input.css';
import App from './App.jsx';

const container = document.getElementById('root');
if (container) {
  const reinit = () => {
    if (typeof window !== 'undefined' && typeof window.initAdminDashboard === 'function') {
      window.initAdminDashboard();
    }
  };

  if (container.hasChildNodes()) {
    hydrateRoot(container, <App />, {
      onRecoverableError: (err) => {
        // Silently tolerate minor markup diffs without failing
      }
    });
  } else {
    const root = createRoot(container);
    root.render(<App />);
  }

  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      reinit();
      setTimeout(reinit, 50);
      setTimeout(reinit, 200);
    });
  }
}

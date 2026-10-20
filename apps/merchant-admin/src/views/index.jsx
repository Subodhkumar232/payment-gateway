import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import '../styles/input.css';
import App from './App.jsx';
import LoginPage from './LoginPage.jsx';

const container = document.getElementById('root');
if (container) {
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
  const Component = isLoginPage ? LoginPage : App;

  const reinit = () => {
    if (typeof window !== 'undefined' && !isLoginPage) {
      if (typeof window.updateAdminAuthUi === 'function') {
        window.updateAdminAuthUi();
      }
      if (typeof window.initAdminDashboard === 'function') {
        window.initAdminDashboard();
      }
    }
  };

  if (container.hasChildNodes()) {
    hydrateRoot(container, <Component />, {
      onRecoverableError: (err) => {
        // Silently tolerate minor markup diffs without failing
      }
    });
  } else {
    const root = createRoot(container);
    root.render(<Component />);
  }

  if (typeof window !== 'undefined' && !isLoginPage) {
    requestAnimationFrame(() => {
      reinit();
      setTimeout(reinit, 50);
      setTimeout(reinit, 200);
    });
  }
}

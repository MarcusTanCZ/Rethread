// Entry point: mounts <App /> inside the store and toast providers and loads global styles.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppFallback, ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { StoreProvider } from './state/store';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={() => <AppFallback />}>
      <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

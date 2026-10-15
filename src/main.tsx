import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Global safety guard for Firestore background quota errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = String(reason?.message || reason || '');
    if (
      msg.includes('Quota limit exceeded') ||
      msg.includes('resource-exhausted') ||
      reason?.code === 'resource-exhausted'
    ) {
      event.preventDefault();
      try {
        localStorage.setItem('bazaarx_fs_quota_exceeded', String(Date.now()));
      } catch {}
      console.warn('[Handled Background Notice]: Firestore free tier quota limit reached. Handled seamlessly by Supabase.');
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event?.message || '');
    if (msg.includes('Quota limit exceeded') || msg.includes('resource-exhausted')) {
      event.preventDefault();
      try {
        localStorage.setItem('bazaarx_fs_quota_exceeded', String(Date.now()));
      } catch {}
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

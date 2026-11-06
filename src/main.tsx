import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Seamlessly transition out the initial branded loading screen
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    (window as any).__dismissInitialLoader?.();
  });
}

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { useAuthStore } from '@store/authStore';
import './styles/index.css';

function Root() {
  const initialize = useAuthStore((s) => s.initialize);

  /* Attempt silent token refresh once on mount.
     Sets isLoading → false regardless of outcome so routes unblock. */
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <App />
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 80 }}
        toastOptions={{
          duration: 4000,
          style: {
            background:   '#1e293b',
            color:        '#f8fafc',
            border:       '1px solid rgba(6, 148, 162, 0.2)',
            borderRadius: '12px',
            fontSize:     '14px',
            fontFamily:   'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#48bb78', secondary: '#1e293b' } },
          error:   { iconTheme: { primary: '#f56565', secondary: '#1e293b' } },
        }}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);

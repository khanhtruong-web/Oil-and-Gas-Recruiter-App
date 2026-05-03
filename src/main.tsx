import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children; 
  }
}

const root = document.getElementById('root')!;

// Handle Google OAuth implicit grant callback
if (window.location.pathname === '/auth/callback') {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');
      const error = params.get('error');

      if (accessToken && window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_AUTH_SUCCESS',
          token: accessToken,
          expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600
        }, '*');
        root.innerHTML = '<div style="padding: 20px; font-family: sans-serif;">Authentication successful! Closing window...</div>';
        setTimeout(() => window.close(), 100);
      } else if (error && window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_AUTH_ERROR',
          error: error
        }, '*');
        root.innerHTML = `<div style="padding: 20px; font-family: sans-serif; color: red;">Authentication failed: ${error}</div>`;
      } else {
        root.innerHTML = '<div style="padding: 20px; font-family: sans-serif;">Processing authentication... Please wait.</div>';
      }
    } else {
      root.innerHTML = '<div style="padding: 20px; font-family: sans-serif; color: red;">Invalid authentication response. No token found.</div>';
    }
} else {
    root.innerHTML = '';
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
}


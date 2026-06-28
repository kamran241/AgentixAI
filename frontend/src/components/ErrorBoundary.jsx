import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh',
          background: 'var(--bg-primary)', color: 'var(--text-main)',
          gap: '1rem', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h2 style={{ fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button
            style={{
              marginTop: '0.5rem', padding: '0.5rem 1.25rem',
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

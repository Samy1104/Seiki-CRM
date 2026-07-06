import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-screen">
          <h1>Une erreur est survenue</h1>
          <p>Cette vue a rencontré un problème inattendu. Vous pouvez réessayer ou recharger l'application.</p>
          <pre className="error-boundary-detail">{this.state.error.message}</pre>
          <button className="btn-primary-sm" onClick={() => this.setState({ error: null })}>
            Réessayer
          </button>
          <button className="btn-ghost-sm" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

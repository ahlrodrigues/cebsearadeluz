import React from 'react'

type State = { hasError: boolean; error?: any }

class DevErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('[DevErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Erro na interface</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack || this.state.error || 'Erro desconhecido')}</pre>
          <p>Confira o console do navegador para detalhes.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default DevErrorBoundary


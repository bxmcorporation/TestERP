import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6 inline-flex p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-display font-bold text-gray-900 mb-2">
              Algo deu errado
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Ocorreu um erro inesperado. Tente recarregar a pagina.
            </p>
            <button onClick={this.handleReset} className="btn-primary">
              <RefreshCw size={16} /> Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

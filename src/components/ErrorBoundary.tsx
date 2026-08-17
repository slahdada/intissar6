import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };
  public props: Props;
  public setState: any;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 antialiased">
          <div className="max-w-md w-full bg-slate-800 border-2 border-slate-700 p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/40">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-black uppercase tracking-wider text-white">
                Erreur d’affichage détectée
              </h1>
              <p className="text-xs text-slate-300">
                Une anomalie temporaire est survenue lors du rendu de la page.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-900 p-3 border border-slate-700 text-left font-mono text-[11px] text-rose-400 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recharger l’application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

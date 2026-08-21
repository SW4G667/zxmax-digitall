import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-page p-6">
          <div className="glass-card max-w-md w-full p-8 text-center">
            <h1 className="text-2xl font-black text-foreground mb-2">
              ZX<span className="text-primary">MAX</span>
            </h1>
            <p className="text-lg font-bold text-foreground mb-2">Algo deu errado</p>
            <p className="text-sm text-muted-foreground mb-1">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <p className="text-[11px] font-mono text-muted-foreground bg-muted p-2 rounded-lg mt-3 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 mt-6">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/70 transition"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 btn-gradient py-2.5 rounded-xl text-sm font-bold"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

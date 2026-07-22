import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(_error, _info) {}

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-md">
            <p className="text-5xl">⚠</p>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-gray-400 text-sm font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15 transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

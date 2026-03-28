import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-red-600 mb-2">Something went wrong</p>
          <p className="text-xs text-slate-500 mb-4 max-w-md">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
            <p className="text-lg font-semibold text-gray-800">Something went wrong</p>
            <p className="text-sm text-gray-500 max-w-md">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0055BB] rounded-lg hover:bg-[#0044a0] transition-colors"
            >
              Reload Page
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}

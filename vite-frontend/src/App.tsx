import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppRouter from '@/routes/AppRouter'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import client from '@/api/client'

export default function VerifyAccountPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    client.get(`/auth/verify/${token}`)
      .then(() => {
        setStatus('success')
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.response?.data?.message || 'Verification failed. The link may be expired or invalid.')
      })
  }, [token])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f4f8',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '48px 40px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        maxWidth: 420,
        width: '90%',
      }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: '#333' }}>Verifying your account...</h2>
            <p style={{ color: '#666' }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#2e7d32' }}>Account Verified!</h2>
            <p style={{ color: '#555' }}>Your doctor account is now active.</p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: 24,
                padding: '12px 32px',
                background: '#1976d2',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Go to Login
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: '#c62828' }}>Verification Failed</h2>
            <p style={{ color: '#666' }}>{message}</p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: 24,
                padding: '12px 32px',
                background: '#1976d2',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  )
}

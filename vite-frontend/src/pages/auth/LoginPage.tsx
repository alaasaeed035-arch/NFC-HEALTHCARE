import React, { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Activity, Eye, EyeOff, AlertCircle, Stethoscope, UserRound, X, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getRoleHome } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import client from '@/api/client'

type LoginType = 'staff' | 'patient'
type ForgotStep = 'email' | 'otp' | 'done'

export default function LoginPage() {
  const { login, isAuthenticated, user, loading: authLoading } = useAuth()
  const [loginType, setLoginType] = useState<LoginType>('staff')
  const [email, setEmail] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Forgot password modal state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')

  if (!authLoading && isAuthenticated && user) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (loginType === 'staff') {
      if (!email.trim()) { setError('Please enter your email address'); return }
      if (!password) { setError('Please enter your password'); return }
    } else {
      if (!nationalId.trim()) { setError('Please enter your National ID'); return }
    }

    setLoading(true)
    try {
      await login({ email, nationalId, password, loginType })
      setFailedAttempts(0)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
      setError(
        axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Login failed. Please check your credentials.'
      )
      setFailedAttempts(n => n + 1)
    } finally {
      setLoading(false)
    }
  }

  const openForgot = () => {
    setForgotEmail(email)
    setForgotStep('email')
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotError('')
    setShowForgot(true)
  }

  const closeForgot = () => {
    setShowForgot(false)
    setForgotError('')
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) { setForgotError('Enter your email'); return }
    setForgotLoading(true); setForgotError('')
    try {
      await client.post('/auth/doctor/forget-password', { email: forgotEmail })
      setForgotStep('otp')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      setForgotError(e?.response?.data?.message ?? e?.message ?? 'Failed to send OTP')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotOtp.trim()) { setForgotError('Enter the OTP'); return }
    if (!forgotNewPassword) { setForgotError('Enter a new password'); return }
    if (forgotNewPassword !== forgotConfirmPassword) { setForgotError('Passwords do not match'); return }
    setForgotLoading(true); setForgotError('')
    try {
      await client.post('/auth/doctor/reset-password', {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      })
      setForgotStep('done')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      setForgotError(e?.response?.data?.message ?? e?.message ?? 'Failed to reset password')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-[#0055BB] to-[#003380] px-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-12 -translate-x-12" />
        <div className="relative z-10 text-center max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mx-auto mb-6">
            <Activity className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">NFC Healthcare</h1>
          <p className="text-blue-200 text-lg mb-8">
            Clinical Decision Support &amp; Patient Management System
          </p>
          <div className="space-y-4 text-left">
            {[
              'NFC-based instant patient identification',
              'AI-powered drug interaction detection',
              'Unified electronic health records',
              'Multi-hospital staff coordination',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-300 flex-shrink-0" />
                <span className="text-blue-100 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0055BB]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NFC Healthcare</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-6">Sign in to your account to continue</p>

            {/* Login type selector */}
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setLoginType('staff'); setError(''); setFailedAttempts(0) }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'staff'
                    ? 'bg-white text-[#0055BB] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Stethoscope className="h-4 w-4" />
                Doctor / Staff
              </button>
              <button
                type="button"
                onClick={() => { setLoginType('patient'); setError(''); setFailedAttempts(0) }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'patient'
                    ? 'bg-white text-[#0055BB] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserRound className="h-4 w-4" />
                Patient
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {loginType === 'staff' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="doctor@hospital.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setFailedAttempts(0) }}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="national-id">National ID</Label>
                  <Input
                    id="national-id"
                    type="text"
                    placeholder="Enter your National ID"
                    value={nationalId}
                    onChange={e => setNationalId(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-400 mt-1">No password needed — your National ID is your key.</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Forgot password hint — appears after 2 failed staff attempts */}
              {failedAttempts >= 2 && loginType === 'staff' && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={openForgot}
                    className="text-sm text-[#0055BB] hover:underline font-medium"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </Button>
            </form>

            {loginType === 'staff' ? (
              <p className="mt-4 text-center text-sm text-gray-500">
                New doctor?{' '}
                <Link to="/signup/doctor" className="text-[#0055BB] font-medium hover:underline">
                  Register here
                </Link>
              </p>
            ) : (
              <p className="mt-4 text-center text-sm text-gray-500">
                New patient?{' '}
                <Link to="/signup/patient" className="text-[#0055BB] font-medium hover:underline">
                  Create your account
                </Link>
              </p>
            )}

            <p className="mt-4 text-center text-xs text-gray-400">
              NFC Healthcare Clinical System &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 relative">
            <button
              onClick={closeForgot}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {forgotStep === 'email' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h3>
                <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a one-time code.</p>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email Address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="doctor@hospital.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {forgotError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />{forgotError}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-10" disabled={forgotLoading}>
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Sending...
                      </span>
                    ) : 'Send OTP'}
                  </Button>
                </form>
              </>
            )}

            {forgotStep === 'otp' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Enter OTP</h3>
                <p className="text-sm text-gray-500 mb-6">
                  A 6-digit code was sent to <span className="font-medium text-gray-700">{forgotEmail}</span>. Enter it below along with your new password.
                </p>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="otp">OTP Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="6-digit code"
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value)}
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showForgotPassword ? 'text' : 'password'}
                        placeholder="Min 8 chars, upper, lower, number, symbol"
                        value={forgotNewPassword}
                        onChange={e => setForgotNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showForgotPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repeat new password"
                      value={forgotConfirmPassword}
                      onChange={e => setForgotConfirmPassword(e.target.value)}
                    />
                  </div>
                  {forgotError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />{forgotError}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-10" disabled={forgotLoading}>
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Resetting...
                      </span>
                    ) : 'Reset Password'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setForgotStep('email'); setForgotError('') }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
                  >
                    ← Use a different email
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'done' && (
              <div className="text-center py-4 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Password Reset!</h3>
                <p className="text-sm text-gray-500">Your password has been updated. You can now sign in with your new password.</p>
                <Button className="w-full h-10" onClick={closeForgot}>Back to Sign In</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

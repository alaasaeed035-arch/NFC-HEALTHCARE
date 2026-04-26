import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import client from '@/api/client'

interface FormData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  specialization: string
  phoneNumber: string
  hospitalId: string
}

const EMPTY: FormData = {
  firstName: '', lastName: '', email: '', password: '',
  confirmPassword: '', specialization: '', phoneNumber: '', hospitalId: '',
}

export default function DoctorSignupPage() {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
    setApiError('')
  }

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!form.firstName.trim())       e.firstName = 'Required'
    if (!form.lastName.trim())        e.lastName = 'Required'
    if (!form.email.trim())           e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (!form.password)               e.password = 'Required'
    else if (form.password.length < 6) e.password = 'Minimum 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!form.specialization.trim())  e.specialization = 'Required'
    if (!form.phoneNumber.trim())     e.phoneNumber = 'Required'
    if (!form.hospitalId.trim())      e.hospitalId = 'Hospital ID is required'
    else if (!/^[a-fA-F0-9]{24}$/.test(form.hospitalId.trim())) e.hospitalId = 'Invalid hospitalId'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setApiError('')
    try {
      await client.post('/auth/signup/doctor', {
        firstName:      form.firstName,
        lastName:       form.lastName,
        email:          form.email,
        password:       form.password,
        specialization: form.specialization,
        phoneNumber:    form.phoneNumber,
        hospitalId:     form.hospitalId.trim(),
      })
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setApiError(e?.response?.data?.message ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your account has been created. Please check your email inbox and click the
            verification link to activate your account before logging in.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full h-10 rounded-lg text-sm font-medium text-white bg-[#0055BB] hover:bg-[#0044a0] transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-[#0055BB] to-[#003380] px-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-12 -translate-x-12" />
        <div className="relative z-10 text-center max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mx-auto mb-6">
            <Activity className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Join NFC Healthcare</h1>
          <p className="text-blue-200 text-lg mb-8">
            Register as a doctor to access clinical decision support tools
          </p>
          <div className="space-y-4 text-left">
            {[
              'AI-powered drug interaction detection',
              'NFC patient identification at bedside',
              'Unified electronic health records',
              'Real-time clinical decision support',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-300 flex-shrink-0" />
                <span className="text-blue-100 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0055BB]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NFC Healthcare</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Doctor Registration</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create your account — you'll receive a verification email before you can log in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" error={errors.firstName}>
                  <Input placeholder="First name" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                </Field>
                <Field label="Last Name *" error={errors.lastName}>
                  <Input placeholder="Last name" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </Field>
              </div>

              <Field label="Email Address *" error={errors.email}>
                <Input type="email" placeholder="doctor@hospital.com" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
              </Field>

              <Field label="Password *" error={errors.password}>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
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
              </Field>

              <Field label="Confirm Password *" error={errors.confirmPassword}>
                <Input type="password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} autoComplete="new-password" />
              </Field>

              <Field label="Specialization *" error={errors.specialization}>
                <Input placeholder="e.g. Cardiology, Neurology" value={form.specialization} onChange={e => set('specialization', e.target.value)} />
              </Field>

              <Field label="Phone Number *" error={errors.phoneNumber}>
                <Input type="tel" placeholder="+20 1xx xxx xxxx" value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} />
              </Field>

              <Field
                label="Hospital ID *"
                error={errors.hospitalId}
                hint="Enter the Hospital ID provided by your administrator"
              >
                <Input
                  placeholder="e.g. 507f1f77bcf86cd799439011"
                  value={form.hospitalId}
                  onChange={e => set('hospitalId', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              {apiError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {apiError}
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Registering...
                  </span>
                ) : 'Create Account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-[#0055BB] font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

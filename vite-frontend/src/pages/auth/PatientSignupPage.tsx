import React, { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, AlertCircle, X, Eye, EyeOff, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select'
import client from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  firstName: string
  lastName: string
  nationalId: string
  cardId: string
  email: string
  password: string
  confirmPassword: string
  gender: string
  dateOfBirth: string
  bloodType: string
  phoneNumber: string
  address: string
  ecName: string
  ecPhone: string
  ecRelation: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  nationalId?: string
  cardId?: string
  email?: string
  password?: string
  confirmPassword?: string
  gender?: string
  dateOfBirth?: string
  phoneNumber?: string
  address?: string
  ecName?: string
  ecPhone?: string
  ecRelation?: string
}

const EMPTY: FormData = {
  firstName: '', lastName: '', nationalId: '', cardId: '',
  email: '', password: '', confirmPassword: '',
  gender: '', dateOfBirth: '', bloodType: '',
  phoneNumber: '', address: '',
  ecName: '', ecPhone: '', ecRelation: '',
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const PHONE_RE = /^01[0-2,5]{1}[0-9]{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  placeholder: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (i: number) => void
}) {
  const [value, setValue] = useState('')

  const commit = () => {
    const v = value.trim()
    if (v && !items.includes(v)) onAdd(v)
    setValue('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        />
        <Button type="button" variant="outline" onClick={commit} className="shrink-0 px-3">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-blue-900 leading-none"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
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

function Section({ title }: { title: string }) {
  return (
    <div className="pt-2 pb-1 border-b border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
    </div>
  )
}

// ─── OTP Verification Screen ──────────────────────────────────────────────────

function OtpScreen({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [resendMsg, setResendMsg] = useState('')


  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) { setError('Please enter the verification code'); return }
    setLoading(true); setError('')
    try {
      const res = await client.post('/auth/verify-patient-otp', { email, otp: otp.trim() })
      // auto-login: store token and load profile
      const tok: string = res.data.token
      if (tok) {
        localStorage.setItem('nfc_token', tok)
        const profileRes = await client.get('/auth/me')
        const patientData = profileRes.data.data
        const userData = {
          _id: patientData._id,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          role: 'patient' as const,
        }
        localStorage.setItem('nfc_user', JSON.stringify(userData))
      }
      onVerified()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true); setError(''); setResendMsg('')
    try {
      await client.post('/auth/resend-patient-otp', { email })
      setResendMsg('A new code has been sent to your email.')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Failed to resend code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mx-auto mb-4">
          <Activity className="h-8 w-8 text-[#0055BB]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">Verify your email</h2>
        <p className="text-gray-500 text-sm mb-6 text-center">
          We sent a 6-digit code to <span className="font-medium text-gray-700">{email}</span>. Enter it below to activate your account.
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1">
            <Label>Verification Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={otp}
              onChange={e => { setOtp(e.target.value); setError('') }}
              maxLength={6}
              autoFocus
              className="text-center text-lg tracking-widest"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {resendMsg && (
            <p className="text-xs text-green-600 text-center">{resendMsg}</p>
          )}

          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Verifying...
              </span>
            ) : 'Verify & Sign In'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Didn't receive a code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-[#0055BB] font-medium hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientSignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})
  const [surgerys, setSurgerys] = useState<string[]>([])
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [nfcScanning, setNfcScanning] = useState(false)
  const [nfcError, setNfcError] = useState('')
  const nfcActiveRef = useRef(false)

  const handleScanNfc = async () => {
    if (!('NDEFReader' in window)) {
      setNfcError('NFC not supported on this device. Please enter the card number manually.')
      return
    }
    setNfcScanning(true)
    setNfcError('')
    nfcActiveRef.current = true
    try {
      const ndef = new (window as unknown as {
        NDEFReader: new () => {
          scan: () => Promise<void>
          onreading: ((e: { message: { records: { recordType: string; data: ArrayBuffer }[] } }) => void) | null
        }
      }).NDEFReader()
      await ndef.scan()
      ndef.onreading = ({ message }) => {
        if (!nfcActiveRef.current) return
        nfcActiveRef.current = false
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder()
            const text = decoder.decode(record.data)
            set('cardId', text.trim())
            setNfcScanning(false)
            return
          }
        }
        setNfcError('No card number found on this NFC chip.')
        setNfcScanning(false)
      }
      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (!nfcActiveRef.current) return
        nfcActiveRef.current = false
        setNfcScanning(false)
        setNfcError('Scan timed out. Please try again.')
      }, 15000)
    } catch (err: unknown) {
      nfcActiveRef.current = false
      const e = err as { message?: string }
      setNfcError(e?.message ?? 'Failed to start NFC scan.')
      setNfcScanning(false)
    }
  }

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field as keyof FormErrors]: '' }))
    setApiError('')
  }

  const validate = (): boolean => {
    const e: FormErrors = {}

    if (!form.firstName.trim())  e.firstName  = 'First name is required'
    if (!form.lastName.trim())   e.lastName   = 'Last name is required'
    if (!form.nationalId.trim()) e.nationalId = 'National ID is required'

    if (!form.email.trim()) {
      e.email = 'Email is required'
    } else if (!EMAIL_RE.test(form.email.trim())) {
      e.email = 'Enter a valid email address'
    }

    if (!form.password) {
      e.password = 'Password is required'
    } else if (form.password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    }

    if (!form.confirmPassword) {
      e.confirmPassword = 'Please confirm your password'
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match'
    }

    if (!form.gender) e.gender = 'Gender is required'

    if (!form.dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required'
    } else if (new Date(form.dateOfBirth) >= new Date()) {
      e.dateOfBirth = 'Date of birth must be in the past'
    }

    if (!form.phoneNumber.trim()) {
      e.phoneNumber = 'Phone number is required'
    } else if (!PHONE_RE.test(form.phoneNumber.trim())) {
      e.phoneNumber = 'Must be a valid Egyptian mobile number (e.g. 01012345678)'
    }

    if (!form.address.trim()) e.address = 'Address is required'

    if (!form.ecName.trim())     e.ecName     = 'Emergency contact name is required'
    if (!form.ecRelation.trim()) e.ecRelation = 'Relation is required'
    if (!form.ecPhone.trim()) {
      e.ecPhone = 'Emergency contact phone is required'
    } else if (!PHONE_RE.test(form.ecPhone.trim())) {
      e.ecPhone = 'Must be a valid Egyptian mobile number'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setApiError('')
    try {
      await client.post('/auth/signup/patient/self', {
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        nationalId:   form.nationalId.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        cardId:       form.cardId.trim() || undefined,
        gender:       form.gender,
        dateOfBirth:  form.dateOfBirth,
        bloodType:    form.bloodType || undefined,
        phoneNumber:  form.phoneNumber.trim(),
        address:      form.address.trim(),
        emergencyContact: {
          name:     form.ecName.trim(),
          phone:    form.ecPhone.trim(),
          relation: form.ecRelation.trim(),
        },
        surgerys:        surgerys.length > 0 ? surgerys : undefined,
        ChronicDiseases: chronicDiseases.length > 0 ? chronicDiseases : undefined,
      })
      setOtpEmail(form.email.trim().toLowerCase())
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setApiError(e?.response?.data?.message ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── OTP step ────────────────────────────────────────────────────────────────
  if (otpEmail && !verified) {
    return (
      <OtpScreen
        email={otpEmail}
        onVerified={() => {
          setVerified(true)
          // Redirect to patient dashboard since auto-login token is stored
          navigate('/patient/health-passport', { replace: true })
        }}
      />
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-center bg-gradient-to-br from-[#0055BB] to-[#003380] px-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-12 -translate-x-12" />
        <div className="relative z-10 text-center max-w-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mx-auto mb-6">
            <Activity className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Join NFC Healthcare</h1>
          <p className="text-blue-200 text-lg mb-8">
            Create your health passport and access your records anytime
          </p>
          <div className="space-y-4 text-left">
            {[
              'Instant identification via NFC card',
              'Your full medical history in one place',
              'Drug interaction alerts for your safety',
              'AI-powered health assistant',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-300 shrink-0" />
                <span className="text-blue-100 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-start justify-center bg-[#F8FAFC] px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0055BB]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NFC Healthcare</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Patient Registration</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create your account — verify your email to sign in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* ── Personal Information ── */}
              <Section title="Personal Information" />

              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" error={errors.firstName}>
                  <Input
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last Name *" error={errors.lastName}>
                  <Input
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                    autoComplete="family-name"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="National ID *" error={errors.nationalId}>
                  <Input
                    placeholder="e.g. 30001011234567"
                    value={form.nationalId}
                    onChange={e => set('nationalId', e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="NFC Card ID"
                  hint={nfcScanning ? 'Hold your NFC card near the device...' : 'Optional — tap your card or enter the number printed on it'}
                  error={errors.cardId || nfcError}
                >
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. NFC-0012345"
                      value={form.cardId}
                      onChange={e => { set('cardId', e.target.value); setNfcError('') }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleScanNfc}
                      disabled={nfcScanning}
                      className="shrink-0 gap-1.5 px-3"
                      title="Tap NFC card to read card number"
                    >
                      {nfcScanning
                        ? <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-[#0055BB] animate-spin" />
                        : <Wifi className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender *" error={errors.gender}>
                  <Select value={form.gender} onValueChange={v => set('gender', v)}>
                    <SelectTrigger className={errors.gender ? 'border-red-400' : ''}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of Birth *" error={errors.dateOfBirth}>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => set('dateOfBirth', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </Field>
              </div>

              <Field label="Blood Type" hint="Optional — recommended for emergencies">
                <Select value={form.bloodType} onValueChange={v => set('bloodType', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map(bt => (
                      <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* ── Account Credentials ── */}
              <Section title="Account Credentials" />

              <Field label="Email Address *" error={errors.email}>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  autoComplete="email"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Password *" error={errors.password}>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      autoComplete="new-password"
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
                </Field>
                <Field label="Confirm Password *" error={errors.confirmPassword}>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      onChange={e => set('confirmPassword', e.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirm ? 'Hide' : 'Show'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              </div>

              {/* ── Contact Information ── */}
              <Section title="Contact Information" />

              <Field label="Phone Number *" error={errors.phoneNumber} hint="Egyptian mobile: 01xxxxxxxxx">
                <Input
                  type="tel"
                  placeholder="e.g. 01012345678"
                  value={form.phoneNumber}
                  onChange={e => set('phoneNumber', e.target.value)}
                  autoComplete="tel"
                />
              </Field>

              <Field label="Address *" error={errors.address}>
                <Input
                  placeholder="Street, city, governorate"
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  autoComplete="street-address"
                />
              </Field>

              {/* ── Emergency Contact ── */}
              <Section title="Emergency Contact" />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name *" error={errors.ecName}>
                  <Input
                    placeholder="Contact's full name"
                    value={form.ecName}
                    onChange={e => set('ecName', e.target.value)}
                  />
                </Field>
                <Field label="Relation *" error={errors.ecRelation}>
                  <Input
                    placeholder="e.g. Mother, Spouse"
                    value={form.ecRelation}
                    onChange={e => set('ecRelation', e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Phone Number *" error={errors.ecPhone} hint="Egyptian mobile: 01xxxxxxxxx">
                <Input
                  type="tel"
                  placeholder="e.g. 01098765432"
                  value={form.ecPhone}
                  onChange={e => set('ecPhone', e.target.value)}
                />
              </Field>

              {/* ── Medical History (optional) ── */}
              <Section title="Medical History (Optional)" />

              <Field label="Chronic Diseases" hint="Press Enter or click Add after each entry">
                <TagInput
                  placeholder="e.g. Diabetes, Hypertension"
                  items={chronicDiseases}
                  onAdd={v => setChronicDiseases(prev => [...prev, v])}
                  onRemove={i => setChronicDiseases(prev => prev.filter((_, idx) => idx !== i))}
                />
              </Field>

              <Field label="Previous Surgeries" hint="Press Enter or click Add after each entry">
                <TagInput
                  placeholder="e.g. Appendectomy 2019"
                  items={surgerys}
                  onAdd={v => setSurgerys(prev => [...prev, v])}
                  onRemove={i => setSurgerys(prev => prev.filter((_, idx) => idx !== i))}
                />
              </Field>

              {/* ── API error ── */}
              {apiError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {apiError}
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating account...
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

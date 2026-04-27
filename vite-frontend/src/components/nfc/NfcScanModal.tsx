import React, { useState, useEffect, useRef } from 'react'
import { Wifi, User, Droplets, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Spinner } from '@/components/ui/Spinner'
import type { Patient } from '@/types'
import client from '@/api/client'

const NFC_BRIDGE = 'http://localhost:8002'
const POLL_MS = 500

interface NfcScanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPatientFound: (patient: Patient) => void
}

type BridgeStatus = 'checking' | 'connected' | 'unavailable'

export function NfcScanModal({ open, onOpenChange, onPatientFound }: NfcScanModalProps) {
  const [nationalId, setNationalId] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null)
  const [error, setError] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('checking')

  // refs so the poll callback always sees current values without re-creating the interval
  const lastUidRef = useRef<string | null>(null)
  const searchingRef = useRef(false)
  const patientFoundRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      lastUidRef.current = null
      searchingRef.current = false
      patientFoundRef.current = false
      setBridgeStatus('checking')
      return
    }

    const pollCard = async () => {
      if (searchingRef.current || patientFoundRef.current) return
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 1000)
        const res = await fetch(`${NFC_BRIDGE}/nfc/card`, { signal: controller.signal })
        clearTimeout(t)
        const data: { uid: string | null; present: boolean; reader_available: boolean } = await res.json()

        if (!data.reader_available) {
          setBridgeStatus('unavailable')
          return
        }
        setBridgeStatus('connected')

        if (data.present && data.uid && data.uid !== lastUidRef.current) {
          lastUidRef.current = data.uid
          searchingRef.current = true
          setSearching(true)
          setError('')
          try {
            const patientRes = await client.get(`/auth/patient/by-card-id/${data.uid}`)
            const patient: Patient = patientRes.data?.data ?? patientRes.data
            patientFoundRef.current = true
            setFoundPatient(patient)
          } catch {
            setError('No patient is registered with this card.')
            lastUidRef.current = null // allow retry on next tap
          } finally {
            setSearching(false)
            searchingRef.current = false
          }
        } else if (!data.present) {
          lastUidRef.current = null // card removed — ready for next tap
        }
      } catch {
        setBridgeStatus('unavailable')
      }
    }

    pollCard()
    intervalRef.current = setInterval(pollCard, POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [open])

  const handleManualSearch = async () => {
    if (!nationalId.trim()) return
    setSearching(true)
    setError('')
    try {
      const res = await client.get(`/auth/patient/by-national-id/${nationalId.trim()}`)
      const patient: Patient = res.data?.data ?? res.data
      setFoundPatient(patient)
      patientFoundRef.current = true
    } catch {
      setError('Patient not found. Please check the National ID.')
    } finally {
      setSearching(false)
    }
  }

  const handleConfirm = () => {
    if (foundPatient) {
      onPatientFound(foundPatient)
      onOpenChange(false)
      setFoundPatient(null)
      setNationalId('')
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setFoundPatient(null)
    setNationalId('')
    setError('')
  }

  const BridgeIndicator = () => {
    if (bridgeStatus === 'connected') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          NFC reader connected
        </div>
      )
    }
    if (bridgeStatus === 'unavailable') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertCircle className="h-3.5 w-3.5" />
          NFC reader not detected — use manual entry
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Spinner size="sm" />
        Checking NFC reader…
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>NFC Patient Identification</DialogTitle>
          <DialogDescription>
            Tap patient card to the NFC reader or enter National ID manually
          </DialogDescription>
        </DialogHeader>

        {!foundPatient ? (
          <div className="space-y-6">
            {/* NFC Animation + status */}
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="relative flex items-center justify-center">
                {bridgeStatus === 'connected' && (
                  <>
                    <span className="absolute inline-flex h-24 w-24 rounded-full bg-blue-100 opacity-75 animate-ping" />
                    <span className="absolute inline-flex h-16 w-16 rounded-full bg-blue-200 opacity-60 animate-ping [animation-delay:0.3s]" />
                  </>
                )}
                <div className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full ${bridgeStatus === 'unavailable' ? 'bg-gray-300' : 'bg-[#0055BB]'}`}>
                  {searching
                    ? <Spinner size="sm" className="text-white" />
                    : <Wifi className="h-5 w-5 text-white rotate-90" />
                  }
                </div>
              </div>

              <BridgeIndicator />

              {bridgeStatus === 'connected' && !searching && (
                <p className="text-sm font-medium text-gray-600 animate-pulse">
                  Tap patient card to reader…
                </p>
              )}
              {searching && (
                <p className="text-sm font-medium text-gray-600">Looking up patient…</p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">or enter manually</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="national-id">National ID</Label>
              <div className="flex gap-2">
                <Input
                  id="national-id"
                  placeholder="Enter National ID..."
                  value={nationalId}
                  onChange={e => setNationalId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                />
                <Button onClick={handleManualSearch} disabled={searching || !nationalId.trim()}>
                  {searching ? <Spinner size="sm" /> : 'Find'}
                </Button>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Patient Card Preview */}
            <div className="relative rounded-xl bg-gradient-to-br from-[#0055BB] to-[#003380] p-5 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 translate-y-6 -translate-x-6" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 opacity-80" />
                  <span className="text-xs font-medium opacity-80 tracking-widest uppercase">NFC Health Passport</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {foundPatient.firstName} {foundPatient.lastName}
                    </p>
                    <p className="text-sm opacity-75">{foundPatient.gender}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="opacity-60 text-xs">National ID</p>
                    <p className="font-medium">{foundPatient.nationalId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Droplets className="h-4 w-4 opacity-60" />
                    <div>
                      <p className="opacity-60 text-xs">Blood Type</p>
                      <p className="font-bold text-base">{foundPatient.bloodType ?? 'Unknown'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="opacity-60 text-xs">Date of Birth</p>
                    <p className="font-medium">{new Date(foundPatient.dateOfBirth).toLocaleDateString()}</p>
                  </div>
                  {foundPatient.ChronicDiseases && foundPatient.ChronicDiseases.length > 0 && (
                    <div>
                      <p className="opacity-60 text-xs">Chronic Diseases</p>
                      <p className="font-medium text-xs">{foundPatient.ChronicDiseases.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-green-600 font-medium text-center">Patient identified successfully</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {foundPatient && (
            <Button onClick={handleConfirm}>Confirm &amp; Proceed</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

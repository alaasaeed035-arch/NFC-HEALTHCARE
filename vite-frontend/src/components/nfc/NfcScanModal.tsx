import React, { useState } from 'react'
import { Wifi, User, Droplets, CreditCard } from 'lucide-react'
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

interface NfcScanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPatientFound: (patient: Patient) => void
}

export function NfcScanModal({ open, onOpenChange, onPatientFound }: NfcScanModalProps) {
  const [nationalId, setNationalId] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!nationalId.trim()) return
    setSearching(true)
    setError('')
    try {
      const res = await client.get(`/auth/patient/by-national-id/${nationalId.trim()}`)
      const data = res.data
      const patient: Patient = data.data ?? data
      setFoundPatient(patient)
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
            {/* NFC Animation */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-blue-100 opacity-75 animate-ping" />
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-blue-200 opacity-60 animate-ping [animation-delay:0.3s]" />
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0055BB]">
                  <Wifi className="h-5 w-5 text-white rotate-90" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600 animate-pulse">
                Tap patient card to reader...
              </p>
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
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching || !nationalId.trim()}>
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

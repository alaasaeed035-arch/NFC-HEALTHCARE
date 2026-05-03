import React, { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Search, Pill, Droplets, User, ChevronRight, Plus, Trash2, CheckCircle2,
  AlertTriangle, FileText, Clock, Heart, Scissors, X, Send,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { DDITable } from '@/components/ddi/DDITable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Patient, MedicalRecord, PharmacyInventoryItem } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'

interface MedEntry { name: string; dosage: string; frequency: string; notes: string }
interface DDIEntry {
  medication: string
  severity: string
  hasConflict: boolean
  analysis: string
  recommendations: string[]
}

const SEV_CLASSES: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  high:     'bg-orange-50 border-orange-300 text-orange-800',
  moderate: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  low:      'bg-blue-50 border-blue-300 text-blue-800',
  none:     'bg-green-50 border-green-300 text-green-800',
  unknown:  'bg-gray-50 border-gray-300 text-gray-700',
}
const SEV_ICON: Record<string, string> = {
  critical: '🔴', high: '🟠', moderate: '🟡', low: '🔵', none: '🟢', unknown: '⚪',
}

export default function DoctorDashboard() {
  const location = useLocation()
  const { toast } = useToast()
  const { user } = useAuth()

  const isOwnRecord = (r: MedicalRecord) => {
    const rid = typeof r.doctorId === 'string' ? r.doctorId : (r.doctorId as { _id: string })?._id
    return !!user?._id && rid === user._id
  }

  const getMedAvailability = (name: string): { label: string; className: string } | null => {
    if (!name.trim() || inventory.length === 0) return null
    const lower = name.trim().toLowerCase()
    const found = inventory.find(i =>
      i.name.toLowerCase() === lower || i.genericName?.toLowerCase() === lower
    )
    if (!found) return { label: 'Not in pharmacy', className: 'bg-gray-100 text-gray-500' }
    if (!found.isActive || found.quantityInStock <= 0)
      return { label: 'Out of stock', className: 'bg-red-100 text-red-600' }
    return { label: `In stock (${found.quantityInStock} ${found.unit ?? 'units'})`, className: 'bg-green-100 text-green-700' }
  }

  const resolveInventoryItemId = (name: string): string | undefined => {
    if (!name.trim() || inventory.length === 0) return undefined
    const lower = name.trim().toLowerCase()
    return inventory.find(i =>
      i.name.toLowerCase() === lower || i.genericName?.toLowerCase() === lower
    )?._id
  }

  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  // Queue
  const [queuePatients, setQueuePatients] = useState<Patient[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [search, setSearch] = useState('')

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Add medical record form
  const [newDiagnosis, setNewDiagnosis] = useState('')
  const [newTreatment, setNewTreatment] = useState('')
  const [newMeds, setNewMeds] = useState<{ name: string; dosage: string; frequency: string; duration: string }[]>([
    { name: '', dosage: '', frequency: '', duration: '' },
  ])
  const [addingRecord, setAddingRecord] = useState(false)

  // Prescribe toggle
  const [sendToPharmacist, setSendToPharmacist] = useState(false)
  const [pharmacistNotes, setPharmacistNotes] = useState('')

  // DDI state (inline, before saving)
  const [ddiCheckState, setDdiCheckState] = useState<null | 'checking' | 'reviewed'>(null)
  const [ddiEntries, setDdiEntries] = useState<DDIEntry[]>([])
  const [ddiServiceWarning, setDdiServiceWarning] = useState(false)
  const [ddiRefreshKey, setDdiRefreshKey] = useState(0)

  // Pharmacy inventory (for availability hints)
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([])
  useEffect(() => {
    client.get('/api/pharmacy/inventory').then(res => {
      const d = res.data
      setInventory(Array.isArray(d.data) ? d.data : [])
    }).catch(() => {})
  }, [])

  // Inline add-medication on existing record
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [inlineMed, setInlineMed] = useState({ name: '', dosage: '', frequency: '', duration: '' })
  const [savingInlineMed, setSavingInlineMed] = useState(false)
  const [inlineDdiState, setInlineDdiState] = useState<null | 'checking' | 'reviewed'>(null)
  const [inlineDdiEntries, setInlineDdiEntries] = useState<DDIEntry[]>([])
  const [inlineDdiServiceWarning, setInlineDdiServiceWarning] = useState(false)
  const [inlineSendToPharmacist, setInlineSendToPharmacist] = useState(false)
  const [inlinePharmacistNotes, setInlinePharmacistNotes] = useState('')

  // Dismiss
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true)
    try {
      const res = await client.get('/receptionist/my-patients')
      const d = res.data
      setQueuePatients(Array.isArray(d) ? d : d.data ?? [])
    } finally {
      setLoadingQueue(false)
    }
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const resetForm = () => {
    setNewDiagnosis('')
    setNewTreatment('')
    setNewMeds([{ name: '', dosage: '', frequency: '', duration: '' }])
    setSendToPharmacist(false)
    setPharmacistNotes('')
    setDdiCheckState(null)
    setDdiEntries([])
    setDdiServiceWarning(false)
  }

  const handleSelectPatient = async (p: Patient) => {
    setSelectedPatient(p)
    resetForm()
    setLoadingRecords(true)
    try {
      const res = await client.get(`/medical-record/patient/${p._id}`)
      const d = res.data
      setPatientRecords(Array.isArray(d) ? d : d.data ?? [])
    } catch {
      setPatientRecords([])
    } finally {
      setLoadingRecords(false)
    }
  }

  const stripMed = (med: { name?: string; dosage?: string; dose?: string; frequency?: string; duration?: string; notes?: string }) => ({
    name: med.name ?? '',
    dosage: (med.dosage ?? med.dose ?? '').trim(),
    frequency: (med.frequency ?? '').trim(),
    duration: (med.duration ?? '').trim(),
  })

  const handleRemoveMedication = async (record: MedicalRecord, medIndex: number) => {
    const updatedMeds = record.medications.filter((_, i) => i !== medIndex).map(stripMed)
    try {
      await client.put(`/medical-record/${record._id}`, { medications: updatedMeds })
      toast({ title: 'Medication removed', variant: 'success' })
      if (selectedPatient) handleSelectPatient(selectedPatient)
    } catch {
      toast({ title: 'Failed to remove medication', variant: 'error' })
    }
  }

  const handleDismiss = async () => {
    if (!selectedPatient) return
    setDismissing(true)
    try {
      await client.delete('/receptionist/dismiss-patient', { data: { patientId: selectedPatient._id } })
      toast({ title: `${selectedPatient.firstName} dismissed from queue`, variant: 'success' })
      setSelectedPatient(null)
      setPatientRecords([])
      setDismissOpen(false)
      fetchQueue()
    } catch {
      toast({ title: 'Failed to dismiss patient', variant: 'error' })
    } finally {
      setDismissing(false)
    }
  }

  const getPatientMedications = (): MedEntry[] => {
    const seen = new Set<string>()
    const meds: MedEntry[] = []
    patientRecords.forEach(r => {
      r.medications?.forEach(med => {
        if (med.name && !seen.has(med.name.toLowerCase())) {
          seen.add(med.name.toLowerCase())
          meds.push({ name: med.name, dosage: med.dosage || med.dose || '', frequency: med.duration || '', notes: med.notes || '' })
        }
      })
    })
    return meds
  }

  // Saves the medical record and optionally the prescription after DDI review
  const performSave = async () => {
    if (!selectedPatient) return
    const validMeds = newMeds.filter(m => m.name.trim())
    setAddingRecord(true)
    try {
      await client.post('/medical-record/add', {
        patientId: selectedPatient._id,
        diagnosis: newDiagnosis || 'Medication Update',
        treatment: newTreatment || undefined,
        medications: validMeds,
      })

      if (sendToPharmacist && validMeds.length > 0) {
        await client.post('/api/pharmacy/prescriptions', {
          patientId: selectedPatient._id,
          medications: validMeds.map(m => ({
            inventoryItemId: resolveInventoryItemId(m.name) || undefined,
            name: m.name.trim(),
            dosage: m.dosage.trim() || undefined,
            frequency: m.frequency.trim() || undefined,
            duration: m.duration.trim() || undefined,
          })),
          notes: pharmacistNotes.trim() || undefined,
        })
        toast({ title: 'Record saved & prescription sent to pharmacist', variant: 'success' })
      } else {
        toast({ title: 'Medical record added successfully', variant: 'success' })
      }
      setDdiRefreshKey(k => k + 1)

      resetForm()
      handleSelectPatient(selectedPatient)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      toast({ title: e?.response?.data?.message ?? 'Failed to save', variant: 'error' })
    } finally {
      setAddingRecord(false)
    }
  }

  // Step 1: run DDI check and always show results before any save
  const handleCheckDDI = async () => {
    if (!selectedPatient) return
    const validMeds = newMeds.filter(m => m.name.trim())
    if (!newDiagnosis.trim() && validMeds.length === 0) {
      toast({ title: 'Enter a diagnosis or at least one medication', variant: 'error' })
      return
    }

    setDdiCheckState('checking')
    setDdiEntries([])
    setDdiServiceWarning(false)

    const currentMeds = getPatientMedications()
    const results: DDIEntry[] = []
    let anyFailed = false

    await Promise.allSettled(
      validMeds.map(async med => {
        try {
          const res = await client.post('/api/ai-conflict/check-conflict', {
            patient_id: selectedPatient._id,
            current_medications: currentMeds,
            new_treatment: { name: med.name, dosage: med.dosage, frequency: med.frequency, notes: '' },
          })
          const d = res.data
          const analysis = d.data?.analysis ?? d.analysis ?? d
          results.push({
            medication: med.name,
            severity: analysis.severity ?? 'unknown',
            hasConflict: !!analysis.has_conflict,
            analysis: analysis.analysis ?? '',
            recommendations: analysis.recommendations ?? [],
          })
        } catch {
          anyFailed = true
        }
      })
    )

    setDdiEntries(results)
    setDdiServiceWarning(anyFailed)
    // Always show results — doctor must explicitly confirm before anything is saved
    setDdiCheckState('reviewed')
  }

  const resetInlineForm = () => {
    setExpandedRecordId(null)
    setInlineMed({ name: '', dosage: '', frequency: '', duration: '' })
    setInlineDdiState(null)
    setInlineDdiEntries([])
    setInlineDdiServiceWarning(false)
    setInlineSendToPharmacist(false)
    setInlinePharmacistNotes('')
  }

  const handleInlineCheckDDI = async () => {
    if (!inlineMed.name.trim()) {
      toast({ title: 'Drug name is required', variant: 'error' })
      return
    }
    if (!selectedPatient) return
    setInlineDdiState('checking')
    setInlineDdiEntries([])
    setInlineDdiServiceWarning(false)

    const currentMeds = getPatientMedications()
    const results: DDIEntry[] = []
    let anyFailed = false

    try {
      const res = await client.post('/api/ai-conflict/check-conflict', {
        patient_id: selectedPatient._id,
        current_medications: currentMeds,
        new_treatment: {
          name: inlineMed.name.trim(),
          dosage: inlineMed.dosage.trim(),
          frequency: inlineMed.frequency.trim(),
          notes: '',
        },
      })
      const d = res.data
      const analysis = d.data?.analysis ?? d.analysis ?? d
      results.push({
        medication: inlineMed.name.trim(),
        severity: analysis.severity ?? 'unknown',
        hasConflict: !!analysis.has_conflict,
        analysis: analysis.analysis ?? '',
        recommendations: analysis.recommendations ?? [],
      })
    } catch {
      anyFailed = true
    }

    setInlineDdiEntries(results)
    setInlineDdiServiceWarning(anyFailed)
    setInlineDdiState('reviewed')
  }

  const handleAddMedToRecord = async (record: MedicalRecord) => {
    setSavingInlineMed(true)
    try {
      const newMed = {
        name: inlineMed.name.trim(),
        dosage: inlineMed.dosage.trim(),
        frequency: inlineMed.frequency.trim(),
        duration: inlineMed.duration.trim(),
      }
      const updatedMeds = [...(record.medications ?? []).map(stripMed), newMed]
      await client.put(`/medical-record/${record._id}`, { medications: updatedMeds })

      if (inlineSendToPharmacist && selectedPatient) {
        await client.post('/api/pharmacy/prescriptions', {
          patientId: selectedPatient._id,
          medications: [{ inventoryItemId: resolveInventoryItemId(newMed.name) || undefined, ...newMed }],
          notes: inlinePharmacistNotes.trim() || undefined,
        })
        toast({ title: 'Medication added & prescription sent to pharmacist', variant: 'success' })
      } else {
        toast({ title: 'Medication added to record', variant: 'success' })
      }
      setDdiRefreshKey(k => k + 1)

      resetInlineForm()
      if (selectedPatient) handleSelectPatient(selectedPatient)
    } catch {
      toast({ title: 'Failed to add medication', variant: 'error' })
    } finally {
      setSavingInlineMed(false)
    }
  }

  // For non-prescription saves (no DDI needed)
  const handleAddRecord = async () => {
    if (!selectedPatient) return
    if (!newDiagnosis.trim() && newMeds.filter(m => m.name.trim()).length === 0) {
      toast({ title: 'Enter a diagnosis or at least one medication', variant: 'error' })
      return
    }
    await performSave()
  }

  const isInQueue = selectedPatient && queuePatients.some(p => p._id === selectedPatient._id)
  const filteredQueue = queuePatients.filter(p => {
    const q = search.toLowerCase()
    return p.firstName?.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q) || p.nationalId?.toLowerCase().includes(q)
  })

  if (loadingQueue) return (
    <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
  )

  return (
    <div className="space-y-6">
      {/* Quick-nav */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => document.getElementById('patients')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Patient Queue
        </button>
        {queuePatients.length > 0 && (
          <button
            onClick={() => document.getElementById('ddi-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5" />DDI Reports
          </button>
        )}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* LEFT: Patient Queue */}
        <div id="patients" className="w-full lg:w-80 flex-shrink-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardIcon className="h-4 w-4 text-[#0055BB]" />
                Forwarded Patients ({queuePatients.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search queue..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {queuePatients.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No patients in queue</p>
                  <p className="text-xs text-gray-300 mt-1">Patients appear here when forwarded by the receptionist</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredQueue.map(p => (
                    <div
                      key={p._id}
                      onClick={() => handleSelectPatient(p)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        selectedPatient?._id === p._id
                          ? 'bg-blue-50 border border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50">
                          <User className="h-5 w-5 text-[#0055BB]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-gray-500">{p.nationalId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.bloodType && <Badge variant="outline" className="text-[10px]">{p.bloodType}</Badge>}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Patient Detail */}
        <div className="flex-1 space-y-4 min-w-0">
          {!selectedPatient ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">Select a patient</p>
                <p className="text-sm text-gray-400 mt-1">Choose a patient from the queue to view their medical data</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Patient Profile */}
              <div className="relative rounded-2xl bg-gradient-to-br from-[#0055BB] via-[#0044a0] to-[#003380] p-5 text-white overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                      <User className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedPatient.firstName} {selectedPatient.lastName}</h3>
                      <p className="text-blue-200 text-sm">ID: {selectedPatient.nationalId}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-blue-100">
                        {selectedPatient.bloodType && <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{selectedPatient.bloodType}</span>}
                        <span>{selectedPatient.gender}</span>
                        {selectedPatient.dateOfBirth && <span>{new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</span>}
                        {selectedPatient.phoneNumber && <span>{selectedPatient.phoneNumber}</span>}
                      </div>
                    </div>
                  </div>
                  {isInQueue && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 flex-shrink-0"
                      onClick={() => setDismissOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />Done
                    </Button>
                  )}
                </div>
                {((selectedPatient.ChronicDiseases?.length ?? 0) > 0 || (selectedPatient.surgerys?.length ?? 0) > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedPatient.ChronicDiseases?.map((d, i) => (
                      <span key={`cd_${i}`} className="bg-red-500/30 text-white text-[10px] px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                    {selectedPatient.surgerys?.map((s, i) => (
                      <span key={`s_${i}`} className="bg-white/15 text-white text-[10px] px-2 py-0.5 rounded-full">
                        <Scissors className="h-2.5 w-2.5 inline mr-0.5" />{s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Medical Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-[#0055BB]" />
                    Medical Records ({patientRecords.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingRecords ? <Spinner size="sm" /> : patientRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No medical records found</p>
                  ) : (
                    <div className="space-y-3">
                      {patientRecords.map(r => (
                        <div key={r._id} className="p-4 border rounded-xl space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-sm text-gray-900">{r.diagnosis}</p>
                              {r.treatment && <p className="text-xs text-gray-500 mt-0.5">Treatment: {r.treatment}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              {r.aiAnalysis && <SeverityBadge severity={r.aiAnalysis.severity} />}
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />{new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {r.medications?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {r.medications.map((med, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full pl-2.5 pr-1 py-1 text-xs font-medium">
                                  <Pill className="h-3 w-3" />
                                  {med.name} {med.dosage || med.dose || ''}
                                  {isOwnRecord(r) && (
                                    <button
                                      onClick={() => handleRemoveMedication(r, i)}
                                      className="ml-1 p-0.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                      title="Remove medication"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {r.aiAnalysis?.hasConflict && (
                            <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5">
                              <div className="flex items-center gap-1.5 text-orange-700 text-xs font-semibold mb-1">
                                <AlertTriangle className="h-3.5 w-3.5" />AI Drug Interaction Alert
                              </div>
                              <p className="text-xs text-orange-600">{r.aiAnalysis.analysis}</p>
                            </div>
                          )}

                          {/* Add medication to existing record — only for records this doctor created */}
                          {isOwnRecord(r) && expandedRecordId === r._id ? (
                            <div className="pt-2 border-t space-y-2">
                              <p className="text-xs font-semibold text-gray-600">Add medication to this record</p>

                              {/* Input fields — hidden once DDI results are shown */}
                              {inlineDdiState !== 'reviewed' && (
                                <>
                                  <div className="space-y-1">
                                  <Input
                                    placeholder="Drug name *"
                                    className="h-8 text-sm"
                                    value={inlineMed.name}
                                    onChange={e => setInlineMed(m => ({ ...m, name: e.target.value }))}
                                    autoFocus
                                  />
                                  {(() => { const a = getMedAvailability(inlineMed.name); return a ? (
                                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.className}`}>{a.label}</span>
                                  ) : null })()}
                                  </div>
                                  <div className="flex gap-2">
                                    <Input placeholder="Dosage" className="flex-1 h-8 text-sm" value={inlineMed.dosage}
                                      onChange={e => setInlineMed(m => ({ ...m, dosage: e.target.value }))} />
                                    <Input placeholder="Frequency" className="flex-1 h-8 text-sm" value={inlineMed.frequency}
                                      onChange={e => setInlineMed(m => ({ ...m, frequency: e.target.value }))} />
                                    <Input placeholder="Duration" className="flex-1 h-8 text-sm" value={inlineMed.duration}
                                      onChange={e => setInlineMed(m => ({ ...m, duration: e.target.value }))} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 border-t">
                                    <input
                                      type="checkbox"
                                      id="inline-send-pharmacist"
                                      checked={inlineSendToPharmacist}
                                      onChange={e => setInlineSendToPharmacist(e.target.checked)}
                                      className="h-4 w-4 rounded accent-[#0055BB] cursor-pointer"
                                    />
                                    <label htmlFor="inline-send-pharmacist" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                                      Also send prescription to pharmacist
                                    </label>
                                  </div>
                                  {inlineSendToPharmacist && (
                                    <Input
                                      placeholder="Notes for pharmacist (optional)…"
                                      className="h-8 text-sm"
                                      value={inlinePharmacistNotes}
                                      onChange={e => setInlinePharmacistNotes(e.target.value)}
                                    />
                                  )}
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={resetInlineForm}>Cancel</Button>
                                    <Button
                                      size="sm"
                                      onClick={handleInlineCheckDDI}
                                      disabled={inlineDdiState === 'checking'}
                                    >
                                      {inlineDdiState === 'checking'
                                        ? <><Spinner size="sm" className="mr-1.5" />Checking…</>
                                        : <><AlertTriangle className="h-3.5 w-3.5 mr-1" />Check Interactions</>
                                      }
                                    </Button>
                                  </div>
                                </>
                              )}

                              {/* DDI results */}
                              {inlineDdiState === 'reviewed' && (
                                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
                                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-[#0055BB]" />
                                    Interaction results for <span className="text-gray-900">{inlineMed.name}</span>
                                  </p>
                                  {inlineDdiEntries.length === 0 && !inlineDdiServiceWarning ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-2.5 py-2">
                                      <span>🟢</span>
                                      <p className="text-xs font-medium text-green-800">No interactions detected — safe to proceed</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {inlineDdiEntries.map((entry, i) => (
                                        <div key={i} className={`rounded-lg border p-2 text-xs ${SEV_CLASSES[entry.severity] ?? SEV_CLASSES.unknown}`}>
                                          <p className="font-semibold">{SEV_ICON[entry.severity] ?? '⚪'} {entry.medication} — {entry.severity} risk</p>
                                          {entry.hasConflict && entry.analysis && <p className="mt-1">{entry.analysis}</p>}
                                          {entry.recommendations?.map((rec, j) => (
                                            <p key={j} className="mt-0.5 flex items-start gap-1">
                                              <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />{rec}
                                            </p>
                                          ))}
                                        </div>
                                      ))}
                                      {inlineDdiServiceWarning && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />DDI service unavailable — verify manually.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      variant="outline" size="sm" className="flex-1"
                                      onClick={() => setInlineDdiState(null)}
                                      disabled={savingInlineMed}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm" className="flex-1"
                                      onClick={() => handleAddMedToRecord(r)}
                                      disabled={savingInlineMed}
                                    >
                                      {savingInlineMed ? <Spinner size="sm" /> : <><Send className="h-3.5 w-3.5 mr-1" />Confirm & Save</>}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : isOwnRecord(r) ? (
                            <button
                              onClick={() => { setExpandedRecordId(r._id); setInlineMed({ name: '', dosage: '', frequency: '', duration: '' }); setInlineDdiState(null); setInlineDdiEntries([]); setInlineDdiServiceWarning(false) }}
                              className="mt-1 flex items-center gap-1 text-xs text-[#0055BB] hover:underline"
                            >
                              <Plus className="h-3 w-3" />Add medication to this record
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Medical Record */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-[#0055BB]" />
                    Add Medical Record
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Diagnosis *</Label>
                      <Input placeholder="e.g., Type 2 Diabetes" value={newDiagnosis} onChange={e => setNewDiagnosis(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Treatment</Label>
                      <Input placeholder="e.g., Lifestyle changes + medication" value={newTreatment} onChange={e => setNewTreatment(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Pill className="h-3.5 w-3.5 text-[#0055BB]" />Medications
                    </Label>
                    {newMeds.map((med, i) => {
                      const avail = getMedAvailability(med.name)
                      return (
                      <div key={i} className="space-y-1.5 p-2.5 border rounded-lg bg-gray-50/50">
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 space-y-1">
                            <Input
                              placeholder="Drug name *"
                              className="h-9 text-sm"
                              value={med.name}
                              onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], name: e.target.value }; setNewMeds(m) }}
                            />
                            {avail && (
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${avail.className}`}>
                                {avail.label}
                              </span>
                            )}
                          </div>
                          {newMeds.length > 1 && (
                            <Button
                              variant="outline" size="sm" className="h-9 px-2 flex-shrink-0 self-start"
                              onClick={() => setNewMeds(newMeds.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="Dosage" className="flex-1 h-8 text-sm" value={med.dosage}
                            onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], dosage: e.target.value }; setNewMeds(m) }} />
                          <Input placeholder="Frequency" className="flex-1 h-8 text-sm" value={med.frequency}
                            onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], frequency: e.target.value }; setNewMeds(m) }} />
                          <Input placeholder="Duration" className="flex-1 h-8 text-sm" value={med.duration}
                            onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], duration: e.target.value }; setNewMeds(m) }} />
                        </div>
                      </div>
                      )
                    })}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setNewMeds([...newMeds, { name: '', dosage: '', frequency: '', duration: '' }])}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Another Medication
                    </Button>
                  </div>

                  {/* Prescribe toggle */}
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <input
                      type="checkbox"
                      id="send-pharmacist"
                      checked={sendToPharmacist}
                      onChange={e => {
                        setSendToPharmacist(e.target.checked)
                        if (!e.target.checked) {
                          setDdiCheckState(null)
                          setDdiEntries([])
                          setDdiServiceWarning(false)
                        }
                      }}
                      className="h-4 w-4 rounded accent-[#0055BB] cursor-pointer"
                    />
                    <label htmlFor="send-pharmacist" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                      Also send prescription to pharmacist
                    </label>
                  </div>

                  {sendToPharmacist && (
                    <Input
                      placeholder="Notes for pharmacist (optional)…"
                      value={pharmacistNotes}
                      onChange={e => setPharmacistNotes(e.target.value)}
                    />
                  )}

                  {/* DDI results panel — always shown after check, doctor must confirm */}
                  {ddiCheckState === 'reviewed' && (
                    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#0055BB]" />Drug Interaction Results
                      </p>

                      {ddiEntries.length === 0 && !ddiServiceWarning ? (
                        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 flex items-center gap-2">
                          <span>🟢</span>
                          <p className="text-sm font-medium text-green-800">No interactions detected — safe to proceed</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ddiEntries.map((r, i) => (
                            <div key={i} className={`rounded-lg border p-2.5 text-xs ${SEV_CLASSES[r.severity] ?? SEV_CLASSES.unknown}`}>
                              <p className="font-semibold">{SEV_ICON[r.severity] ?? '⚪'} {r.medication} — {r.severity} risk</p>
                              {r.hasConflict && r.analysis && <p className="mt-1">{r.analysis}</p>}
                              {r.recommendations?.map((rec, j) => (
                                <p key={j} className="mt-0.5 flex items-start gap-1">
                                  <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />{rec}
                                </p>
                              ))}
                            </div>
                          ))}
                          {ddiServiceWarning && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              Some medications could not be checked — verify manually.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline" size="sm" className="flex-1"
                          onClick={() => setDdiCheckState(null)}
                          disabled={addingRecord}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm" className="flex-1"
                          onClick={performSave}
                          disabled={addingRecord}
                        >
                          {addingRecord
                            ? <Spinner size="sm" />
                            : sendToPharmacist
                              ? <><Send className="h-3.5 w-3.5 mr-1.5" />Save & Send Prescription</>
                              : 'Save Medical Record'
                          }
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Buttons — hidden while DDI results are shown */}
                  {ddiCheckState !== 'reviewed' && (
                    newMeds.some(m => m.name.trim()) ? (
                      <Button
                        className="w-full"
                        onClick={handleCheckDDI}
                        disabled={addingRecord || ddiCheckState === 'checking'}
                      >
                        {ddiCheckState === 'checking'
                          ? <><Spinner size="sm" className="mr-2" />Checking drug interactions…</>
                          : <><AlertTriangle className="h-4 w-4 mr-2" />Check Interactions</>
                        }
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={handleAddRecord}
                        disabled={addingRecord}
                      >
                        {addingRecord ? <><Spinner size="sm" className="mr-2" />Saving…</> : 'Save Medical Record'}
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* DDI Conflict Log */}
      {selectedPatient && queuePatients.length > 0 && (
        <Card id="ddi-log">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />Drug Interaction Conflict Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DDITable patientIds={queuePatients.map(p => p._id)} refreshKey={ddiRefreshKey} />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title="Dismiss Patient"
        description={`Remove ${selectedPatient?.firstName} ${selectedPatient?.lastName} from your queue? This marks the consultation as complete.`}
        confirmLabel="Dismiss"
        onConfirm={handleDismiss}
        loading={dismissing}
        variant="default"
      />
    </div>
  )
}

function SeverityBadge({ severity }: { severity?: string }) {
  const s = (severity ?? 'unknown').toLowerCase()
  const classes: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high:     'bg-orange-100 text-orange-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    low:      'bg-blue-100 text-blue-700',
    none:     'bg-green-100 text-green-700',
    unknown:  'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${classes[s] ?? classes.unknown}`}>
      {s}
    </span>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

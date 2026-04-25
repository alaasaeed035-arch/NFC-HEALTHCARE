import React, { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Search, Pill, Droplets, User, ChevronRight, Plus, Trash2, CheckCircle2,
  ShieldAlert, AlertTriangle, FileText, Clock, Heart, Scissors, X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SeverityBadge } from '@/components/ddi/SeverityBadge'
import { DDITable } from '@/components/ddi/DDITable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Patient, MedicalRecord, DDISeverity } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface MedEntry { name: string; dosage: string; frequency: string; notes: string }
interface ConflictResult {
  has_conflict: boolean; severity: DDISeverity; analysis: string
  recommendations: string[]; interactions: string[]
}

export default function DoctorDashboard() {
  const location = useLocation()
  const { toast } = useToast()

  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  // Queue state
  const [queuePatients, setQueuePatients] = useState<Patient[]>([])
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [search, setSearch] = useState('')

  // Selected patient state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Add medication state
  const [newDiagnosis, setNewDiagnosis] = useState('')
  const [newTreatment, setNewTreatment] = useState('')
  const [newMeds, setNewMeds] = useState<{ name: string; dosage: string; duration: string }[]>([
    { name: '', dosage: '', duration: '' },
  ])
  const [addingRecord, setAddingRecord] = useState(false)

  // Dismiss state
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  // DDI state
  const [ddiPatientId, setDdiPatientId] = useState('')
  const [ddiMed, setDdiMed] = useState<MedEntry>({ name: '', dosage: '', frequency: '', notes: '' })
  const [checkingDDI, setCheckingDDI] = useState(false)
  const [ddiResult, setDdiResult] = useState<ConflictResult | null>(null)
  const [ddiError, setDdiError] = useState('')

  // Fetch queue + all patients
  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true)
    try {
      const [qRes, pRes] = await Promise.allSettled([
        client.get('/receptionist/my-patients'),
        client.get('/auth/patients'),
      ])
      if (qRes.status === 'fulfilled') {
        const d = qRes.value.data
        setQueuePatients(Array.isArray(d) ? d : d.data ?? [])
      }
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setAllPatients(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoadingQueue(false)
    }
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // Select patient & load records
  const handleSelectPatient = async (p: Patient) => {
    setSelectedPatient(p)
    setDdiPatientId(p._id)
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

  // Add new medical record with medications
  const handleAddRecord = async () => {
    if (!selectedPatient) return
    const validMeds = newMeds.filter(m => m.name.trim())
    if (!newDiagnosis.trim() && validMeds.length === 0) {
      toast({ title: 'Enter a diagnosis or at least one medication', variant: 'error' })
      return
    }
    setAddingRecord(true)
    try {
      await client.post('/medical-record/add', {
        patientId: selectedPatient._id,
        diagnosis: newDiagnosis || 'Medication Update',
        treatment: newTreatment || undefined,
        medications: validMeds,
      })
      toast({ title: 'Medical record added successfully', variant: 'success' })
      setNewDiagnosis('')
      setNewTreatment('')
      setNewMeds([{ name: '', dosage: '', duration: '' }])
      handleSelectPatient(selectedPatient) // Refresh records
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      toast({ title: e?.response?.data?.message ?? 'Failed to add record', variant: 'error' })
    } finally {
      setAddingRecord(false)
    }
  }

  // Remove medication from a record
  const handleRemoveMedication = async (record: MedicalRecord, medIndex: number) => {
    const updatedMeds = record.medications.filter((_, i) => i !== medIndex)
    try {
      await client.put(`/medical-record/${record._id}`, { medications: updatedMeds })
      toast({ title: 'Medication removed', variant: 'success' })
      if (selectedPatient) handleSelectPatient(selectedPatient)
    } catch {
      toast({ title: 'Failed to remove medication', variant: 'error' })
    }
  }

  // Dismiss patient from queue
  const handleDismiss = async () => {
    if (!selectedPatient) return
    setDismissing(true)
    try {
      await client.delete('/receptionist/dismiss-patient', {
        data: { patientId: selectedPatient._id },
      })
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

  // DDI check
  const getPatientMedications = (): MedEntry[] => {
    const meds: MedEntry[] = []
    patientRecords.forEach(record => {
      if (record.medications) {
        record.medications.forEach(med => {
          if (med.name && !meds.some(m => m.name.toLowerCase() === med.name.toLowerCase())) {
            meds.push({ name: med.name, dosage: med.dosage || med.dose || '', frequency: med.duration || '', notes: med.notes || '' })
          }
        })
      }
    })
    return meds
  }

  const handleCheckDDI = async () => {
    if (!ddiPatientId) { setDdiError('Select a patient'); return }
    if (!ddiMed.name.trim()) { setDdiError('Enter medication name'); return }
    setCheckingDDI(true); setDdiError(''); setDdiResult(null)
    try {
      const res = await client.post('/api/ai-conflict/check-conflict', {
        patient_id: ddiPatientId, current_medications: getPatientMedications(), new_treatment: ddiMed,
      })
      const d = res.data
      const result: ConflictResult = d.data?.analysis ?? d.analysis ?? d
      setDdiResult(result)
      toast({
        title: result.has_conflict ? 'Drug Interaction Detected' : 'No Conflicts Found',
        description: result.has_conflict ? `Severity: ${result.severity}` : 'Medications appear safe',
        variant: result.has_conflict ? 'error' : 'success',
      })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } }; message?: string }
      setDdiError(e?.response?.data?.message ?? e?.message ?? 'DDI check failed.')
    } finally {
      setCheckingDDI(false)
    }
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
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* LEFT: Patient Queue */}
        <div id="patients" className="w-full lg:w-80 flex-shrink-0 space-y-4">
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
                  <p className="text-xs text-gray-300 mt-1">Patients will appear here when forwarded by the receptionist</p>
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

        {/* CENTER: Patient Detail + Medical Records + Medication Management */}
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
              {/* Patient Profile Card */}
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
                {/* Chronic diseases + surgeries summary */}
                {((selectedPatient.ChronicDiseases?.length ?? 0) > 0 || (selectedPatient.surgerys?.length ?? 0) > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedPatient.ChronicDiseases?.map((d, i) => (
                      <span key={`cd_${i}`} className="bg-red-500/30 text-white text-[10px] px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                    {selectedPatient.surgerys?.map((s, i) => (
                      <span key={`s_${i}`} className="bg-white/15 text-white text-[10px] px-2 py-0.5 rounded-full"><Scissors className="h-2.5 w-2.5 inline mr-0.5" />{s}</span>
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
                                <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full pl-2.5 pr-1 py-1 text-xs font-medium group">
                                  <Pill className="h-3 w-3" />
                                  {med.name} {med.dosage || med.dose || ''}
                                  <button
                                    onClick={() => handleRemoveMedication(r, i)}
                                    className="ml-1 p-0.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Remove medication"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
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
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add New Medical Record / Medications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-[#0055BB]" />
                    Add Medical Record / Medications
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
                    <Label className="flex items-center gap-1.5"><Pill className="h-3.5 w-3.5 text-[#0055BB]" />Medications</Label>
                    {newMeds.map((med, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <Input placeholder="Drug name *" className="flex-1 h-9 text-sm" value={med.name}
                          onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], name: e.target.value }; setNewMeds(m) }} />
                        <Input placeholder="Dosage" className="w-28 h-9 text-sm" value={med.dosage}
                          onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], dosage: e.target.value }; setNewMeds(m) }} />
                        <Input placeholder="Duration" className="w-28 h-9 text-sm" value={med.duration}
                          onChange={e => { const m = [...newMeds]; m[i] = { ...m[i], duration: e.target.value }; setNewMeds(m) }} />
                        {newMeds.length > 1 && (
                          <Button variant="outline" size="sm" className="h-9 px-2"
                            onClick={() => setNewMeds(newMeds.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setNewMeds([...newMeds, { name: '', dosage: '', duration: '' }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Another Medication
                    </Button>
                  </div>
                  <Button className="w-full" onClick={handleAddRecord} disabled={addingRecord}>
                    {addingRecord ? <><Spinner size="sm" /> Saving...</> : 'Save Medical Record'}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* RIGHT: DDI Check — only visible when there are forwarded patients */}
        {queuePatients.length > 0 && <div id="ddi" className="w-full lg:w-72 flex-shrink-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-[#0055BB]" />Drug Interaction Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Patient</Label>
                <Select value={ddiPatientId} onValueChange={setDdiPatientId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {queuePatients.map(p => (
                      <SelectItem key={p._id} value={p._id}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {getPatientMedications().length > 0 && (
                <div>
                  <Label className="text-xs">Current Meds</Label>
                  <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg mt-1">
                    {getPatientMedications().map((m, i) => (
                      <span key={i} className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-medium">{m.name}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">New Medication</Label>
                <Input placeholder="Drug name *" className="h-8 text-xs" value={ddiMed.name}
                  onChange={e => setDdiMed(m => ({ ...m, name: e.target.value }))} />
                <Input placeholder="Dosage" className="h-8 text-xs" value={ddiMed.dosage}
                  onChange={e => setDdiMed(m => ({ ...m, dosage: e.target.value }))} />
              </div>
              {ddiError && <p className="text-xs text-red-500">{ddiError}</p>}
              <Button onClick={handleCheckDDI} disabled={checkingDDI} className="w-full h-8 text-xs">
                {checkingDDI ? <><Spinner size="sm" /> Analyzing...</> : <><ShieldAlert className="h-3.5 w-3.5 mr-1" />Check Interactions</>}
              </Button>
              {ddiResult && (
                <div className={`rounded-xl border p-3 space-y-2 ${ddiResult.has_conflict ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{ddiResult.has_conflict ? 'Conflict Detected' : 'No Conflicts'}</p>
                    <SeverityBadge severity={ddiResult.severity} />
                  </div>
                  <p className="text-[11px] text-gray-700">{ddiResult.analysis}</p>
                  {ddiResult.recommendations?.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5">
                      {ddiResult.recommendations.map((r, i) => <li key={i} className="text-[11px] text-gray-600">{r}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>}
      </div>

      {/* DDI Log — only shown when patients are in queue */}
      {queuePatients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />Drug Interaction Conflict Log
            </CardTitle>
          </CardHeader>
          <CardContent><DDITable patientIds={queuePatients.map(p => p._id)} /></CardContent>
        </Card>
      )}

      {/* Dismiss Confirmation */}
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

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}
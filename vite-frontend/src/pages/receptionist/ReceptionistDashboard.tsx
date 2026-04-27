import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Wifi, Stethoscope, Users, ClipboardList, Eye, MapPin, Phone, CreditCard, Contact } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { NfcScanModal } from '@/components/nfc/NfcScanModal'
import type { Patient, Doctor } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface PatientFormData {
  firstName: string; lastName: string; nationalId: string; gender: string
  dateOfBirth: string; bloodType: string; phoneNumber: string; address: string
  cardId: string; ecName: string; ecPhone: string; ecRelation: string
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function ReceptionistDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['queue', 'patients', 'doctors']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'queue'
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPatient, setSearchPatient] = useState('')
  const [searchDoctor, setSearchDoctor] = useState('')

  const [nfcOpen, setNfcOpen] = useState(false)
  const [scannedPatient, setScannedPatient] = useState<Patient | null>(null)
  const [assignDoctor, setAssignDoctor] = useState('')
  const [assigning, setAssigning] = useState(false)

  const [viewPatient, setViewPatient] = useState<Patient | null>(null)
  const [registerPatientOpen, setRegisterPatientOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [patientForm, setPatientForm] = useState<PatientFormData>({
    firstName: '', lastName: '', nationalId: '', gender: '', dateOfBirth: '',
    bloodType: '', phoneNumber: '', address: '', cardId: '',
    ecName: '', ecPhone: '', ecRelation: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [assignCardPatient, setAssignCardPatient] = useState<Patient | null>(null)
  const [tapCardActiveFor, setTapCardActiveFor] = useState<'register' | 'assign' | null>(null)
  const tapIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, dRes] = await Promise.allSettled([
        client.get('/admin-hospital/patients'),
        client.get('/admin-hospital/doctors'),
      ])
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setPatients(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!scannedPatient || !assignDoctor) return
    setAssigning(true)
    try {
      await client.post('/receptionist/assign-patient', {
        patientId: scannedPatient._id,
        doctorId: assignDoctor,
      })
      toast({ title: 'Patient assigned to doctor', variant: 'success' })
      setScannedPatient(null)
      setAssignDoctor('')
    } catch {
      toast({ title: 'Failed to assign patient', variant: 'error' })
    } finally {
      setAssigning(false)
    }
  }

  const validatePatientForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!patientForm.firstName.trim()) errs.firstName = 'Required'
    if (!patientForm.lastName.trim()) errs.lastName = 'Required'
    if (!patientForm.nationalId.trim()) errs.nationalId = 'Required'
    if (!patientForm.gender) errs.gender = 'Required'
    if (!patientForm.dateOfBirth) errs.dateOfBirth = 'Required'
    if (!patientForm.ecName.trim()) errs.ecName = 'Required'
    if (!patientForm.ecPhone.trim()) errs.ecPhone = 'Required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleRegisterPatient = async () => {
    if (!validatePatientForm()) return
    setSubmitting(true)
    try {
      await client.post('/auth/signup/patient', {
        firstName: patientForm.firstName,
        lastName: patientForm.lastName,
        nationalId: patientForm.nationalId,
        gender: patientForm.gender,
        dateOfBirth: patientForm.dateOfBirth,
        bloodType: patientForm.bloodType || undefined,
        phoneNumber: patientForm.phoneNumber || undefined,
        address: patientForm.address || undefined,
        ...(patientForm.cardId ? { cardId: patientForm.cardId } : {}),
        emergencyContact: {
          name: patientForm.ecName,
          phone: patientForm.ecPhone,
          relation: patientForm.ecRelation,
        },
      })
      toast({ title: 'Patient registered successfully', variant: 'success' })
      setRegisterPatientOpen(false)
      setPatientForm({
        firstName: '', lastName: '', nationalId: '', gender: '', dateOfBirth: '',
        bloodType: '', phoneNumber: '', address: '', cardId: '',
        ecName: '', ecPhone: '', ecRelation: '',
      })
      fetchAll()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to register patient', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const pf = (field: keyof PatientFormData, value: string) => {
    setPatientForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  const stopTapCard = () => {
    if (tapIntervalRef.current) {
      clearInterval(tapIntervalRef.current)
      tapIntervalRef.current = null
    }
    setTapCardActiveFor(null)
  }

  const startTapCard = (onUid: (uid: string) => void) => {
    let lastUid = ''
    let attempts = 0
    tapIntervalRef.current = setInterval(async () => {
      attempts++
      try {
        const r = await fetch('http://localhost:8002/nfc/card')
        const d: { uid: string | null; present: boolean } = await r.json()
        if (d.present && d.uid && d.uid !== lastUid) {
          lastUid = d.uid
          stopTapCard()
          onUid(d.uid)
        }
      } catch {}
      if (attempts >= 20) stopTapCard() // give up after 10 s
    }, 500)
  }

  const filteredPatients = patients.filter(p => {
    const q = searchPatient.toLowerCase()
    return p.firstName.toLowerCase().includes(q) || p.lastName.toLowerCase().includes(q) || p.nationalId.toLowerCase().includes(q)
  })
  const filteredDoctors = doctors.filter(d => {
    const q = searchDoctor.toLowerCase()
    return d.firstName.toLowerCase().includes(q) || d.lastName.toLowerCase().includes(q) || d.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <NfcScanModal
        open={nfcOpen}
        onOpenChange={setNfcOpen}
        onPatientFound={p => setScannedPatient(p)}
      />

      <Tabs value={activeTab} onValueChange={tab => navigate(`${location.pathname}#${tab}`, { replace: true })}>
        <TabsList>
          <TabsTrigger value="queue">
            <ClipboardList className="h-4 w-4 mr-1.5" />Queue Manager
          </TabsTrigger>
          <TabsTrigger value="patients">
            <Users className="h-4 w-4 mr-1.5" />Patients
          </TabsTrigger>
          <TabsTrigger value="doctors">
            <Stethoscope className="h-4 w-4 mr-1.5" />Doctors
          </TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>NFC Patient Check-In</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setNfcOpen(true)} className="w-full h-12 text-base gap-2">
                  <Wifi className="h-5 w-5 rotate-90" />
                  Scan NFC Card
                </Button>

                {scannedPatient ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-gradient-to-br from-[#0055BB] to-[#003380] p-4 text-white">
                      <p className="text-xs opacity-70 mb-2">Identified Patient</p>
                      <p className="text-xl font-bold">{scannedPatient.firstName} {scannedPatient.lastName}</p>
                      <p className="text-sm opacity-80">ID: {scannedPatient.nationalId}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span>Blood: {scannedPatient.bloodType ?? 'Unknown'}</span>
                        <span>Gender: {scannedPatient.gender}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Forward to Doctor</Label>
                      <Select value={assignDoctor} onValueChange={setAssignDoctor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select doctor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.map(d => (
                            <SelectItem key={d._id} value={d._id}>
                              Dr. {d.firstName} {d.lastName}
                              {d.specialization && ` — ${d.specialization}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        className="w-full"
                        onClick={handleAssign}
                        disabled={!assignDoctor || assigning}
                      >
                        {assigning ? <Spinner size="sm" /> : 'Assign to Doctor'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <Wifi className="h-8 w-8 text-gray-300 rotate-90" />
                    </div>
                    <p className="text-sm text-gray-400">Scan a patient card to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 text-center py-8">
                  Active queue management coming soon
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Registered Patients ({patients.length})</CardTitle>
                <Button onClick={() => setRegisterPatientOpen(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Register Patient
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search patients..."
                  className="pl-9"
                  value={searchPatient}
                  onChange={e => setSearchPatient(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>National ID</TableHead>
                      <TableHead>Blood Type</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Card ID</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                          No patients found
                        </TableCell>
                      </TableRow>
                    ) : filteredPatients.map(p => (
                      <TableRow key={p._id}>
                        <TableCell>
                          <div className="font-medium">{p.firstName} {p.lastName}</div>
                          <div className="text-xs text-gray-400">{p.gender}</div>
                        </TableCell>
                        <TableCell>{p.nationalId}</TableCell>
                        <TableCell>
                          {p.bloodType ? <Badge variant="secondary">{p.bloodType}</Badge> : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell>{p.phoneNumber ?? <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell className="text-gray-500 text-xs max-w-[140px] truncate">{p.address ?? <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell className="text-gray-500 text-xs font-mono">{p.cardId ?? <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-400 hover:text-[#0055BB]"
                              aria-label="View patient details"
                              onClick={() => setViewPatient(p)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!p.cardId && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-400 hover:text-green-600"
                                aria-label="Assign NFC card"
                                title="Assign NFC card"
                                onClick={() => setAssignCardPatient(p)}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab — view only, no registration */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Hospital Doctors ({doctors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search doctors..."
                  className="pl-9"
                  value={searchDoctor}
                  onChange={e => setSearchDoctor(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No doctors found
                        </TableCell>
                      </TableRow>
                    ) : filteredDoctors.map(d => (
                      <TableRow key={d._id}>
                        <TableCell>
                          <div className="font-medium">Dr. {d.firstName} {d.lastName}</div>
                        </TableCell>
                        <TableCell className="text-gray-500">{d.email}</TableCell>
                        <TableCell>{d.specialization ?? '—'}</TableCell>
                        <TableCell>{d.phoneNumber ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={d.isVerified ? 'success' : 'secondary'}>
                            {d.isVerified ? 'Verified' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Patient Detail Dialog */}
      <Dialog open={!!viewPatient} onOpenChange={open => { if (!open) setViewPatient(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Full profile information</DialogDescription>
          </DialogHeader>
          {viewPatient && (
            <div className="space-y-4">
              {/* Identity */}
              <div className="rounded-xl bg-gradient-to-br from-[#0055BB] to-[#003380] p-4 text-white">
                <p className="text-xl font-bold">{viewPatient.firstName} {viewPatient.lastName}</p>
                <p className="text-sm opacity-80 mt-0.5">ID: {viewPatient.nationalId}</p>
                <div className="flex items-center gap-4 mt-2 text-sm opacity-90">
                  <span>{viewPatient.gender}</span>
                  {viewPatient.bloodType && <Badge className="bg-white/20 text-white border-0">{viewPatient.bloodType}</Badge>}
                  {viewPatient.dateOfBirth && <span>DOB: {viewPatient.dateOfBirth}</span>}
                </div>
              </div>

              {/* Contact & Address */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</p>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{viewPatient.phoneNumber ?? <span className="text-gray-400">Not provided</span>}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{viewPatient.address ?? <span className="text-gray-400">Not provided</span>}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700 font-mono">{viewPatient.cardId ?? <span className="text-gray-400 font-sans">No card linked</span>}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              {viewPatient.emergencyContact && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Emergency Contact</p>
                  <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Contact className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                      <span className="font-medium text-gray-800">{viewPatient.emergencyContact.name}</span>
                      <span className="text-gray-500 text-xs">({viewPatient.emergencyContact.relation})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm pl-5">
                      <span className="text-gray-700">{viewPatient.emergencyContact.phone}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Medical */}
              {(viewPatient.ChronicDiseases?.length || viewPatient.surgerys?.length) ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medical History</p>
                  {viewPatient.ChronicDiseases?.length ? (
                    <div className="text-sm"><span className="text-gray-500">Chronic: </span>{viewPatient.ChronicDiseases.join(', ')}</div>
                  ) : null}
                  {viewPatient.surgerys?.length ? (
                    <div className="text-sm"><span className="text-gray-500">Surgeries: </span>{viewPatient.surgerys.join(', ')}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign NFC Card Dialog */}
      <Dialog
        open={!!assignCardPatient}
        onOpenChange={open => { if (!open) { stopTapCard(); setAssignCardPatient(null) } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign NFC Card</DialogTitle>
            <DialogDescription>
              {assignCardPatient
                ? `Link a card to ${assignCardPatient.firstName} ${assignCardPatient.lastName}`
                : 'Link an NFC card to this patient'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative flex items-center justify-center">
              {tapCardActiveFor === 'assign' && (
                <>
                  <span className="absolute inline-flex h-24 w-24 rounded-full bg-blue-100 opacity-75 animate-ping" />
                  <span className="absolute inline-flex h-16 w-16 rounded-full bg-blue-200 opacity-60 animate-ping [animation-delay:0.3s]" />
                </>
              )}
              <div className={`relative inline-flex h-14 w-14 items-center justify-center rounded-full ${tapCardActiveFor === 'assign' ? 'bg-[#0055BB]' : 'bg-gray-100'}`}>
                {tapCardActiveFor === 'assign'
                  ? <Spinner size="sm" className="text-white" />
                  : <CreditCard className="h-7 w-7 text-gray-400" />}
              </div>
            </div>
            {tapCardActiveFor === 'assign'
              ? <p className="text-sm text-gray-600 animate-pulse">Tap card to reader…</p>
              : <p className="text-sm text-gray-500">Click "Start Scan" then tap the NFC card on the reader</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { stopTapCard(); setAssignCardPatient(null) }}>
              Cancel
            </Button>
            {tapCardActiveFor !== 'assign' && (
              <Button onClick={() => {
                setTapCardActiveFor('assign')
                startTapCard(async uid => {
                  try {
                    await client.put('/receptionist/assign-card', {
                      patientId: assignCardPatient!._id,
                      cardId: uid,
                    })
                    toast({ title: 'Card assigned successfully', variant: 'success' })
                    setPatients(prev =>
                      prev.map(p => p._id === assignCardPatient!._id ? { ...p, cardId: uid } : p)
                    )
                    setAssignCardPatient(null)
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { message?: string } } }
                    toast({ title: e?.response?.data?.message ?? 'Failed to assign card', variant: 'error' })
                  }
                })
              }}>
                Start Scan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Patient Dialog */}
      <Dialog
        open={registerPatientOpen}
        onOpenChange={v => {
          setRegisterPatientOpen(v)
          if (!v) {
            setPatientForm({
              firstName: '', lastName: '', nationalId: '', gender: '', dateOfBirth: '',
              bloodType: '', phoneNumber: '', address: '', cardId: '',
              ecName: '', ecPhone: '', ecRelation: '',
            })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>Fill in the patient details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name *" error={formErrors.firstName}>
                <Input value={patientForm.firstName} onChange={e => pf('firstName', e.target.value)} placeholder="First name" />
              </FormField>
              <FormField label="Last Name *" error={formErrors.lastName}>
                <Input value={patientForm.lastName} onChange={e => pf('lastName', e.target.value)} placeholder="Last name" />
              </FormField>
            </div>
            <FormField label="National ID *" error={formErrors.nationalId}>
              <Input value={patientForm.nationalId} onChange={e => pf('nationalId', e.target.value)} placeholder="National ID" />
            </FormField>
            <FormField label="NFC Card ID" error="">
              <div className="flex gap-2">
                <Input
                  value={patientForm.cardId}
                  onChange={e => pf('cardId', e.target.value)}
                  placeholder="Card ID (optional)"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={tapCardActiveFor === 'register'}
                  onClick={() => {
                    setTapCardActiveFor('register')
                    startTapCard(uid => pf('cardId', uid))
                  }}
                >
                  {tapCardActiveFor === 'register'
                    ? <><Spinner size="sm" /> Tap…</>
                    : <><Wifi className="h-3.5 w-3.5 rotate-90" /> Tap</>}
                </Button>
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Gender *" error={formErrors.gender}>
                <Select value={patientForm.gender} onValueChange={v => pf('gender', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Blood Type" error={formErrors.bloodType}>
                <Select value={patientForm.bloodType} onValueChange={v => pf('bloodType', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Date of Birth *" error={formErrors.dateOfBirth}>
              <Input type="date" value={patientForm.dateOfBirth} onChange={e => pf('dateOfBirth', e.target.value)} />
            </FormField>
            <FormField label="Phone Number" error="">
              <Input value={patientForm.phoneNumber} onChange={e => pf('phoneNumber', e.target.value)} placeholder="Phone" />
            </FormField>
            <FormField label="Address" error="">
              <Input value={patientForm.address} onChange={e => pf('address', e.target.value)} placeholder="Address" />
            </FormField>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Emergency Contact</p>
            <FormField label="Contact Name *" error={formErrors.ecName}>
              <Input value={patientForm.ecName} onChange={e => pf('ecName', e.target.value)} placeholder="Full name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Contact Phone *" error={formErrors.ecPhone}>
                <Input value={patientForm.ecPhone} onChange={e => pf('ecPhone', e.target.value)} placeholder="01xxxxxxxxx" />
              </FormField>
              <FormField label="Relation" error="">
                <Input value={patientForm.ecRelation} onChange={e => pf('ecRelation', e.target.value)} placeholder="e.g. Father" />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterPatientOpen(false)}>Cancel</Button>
            <Button onClick={handleRegisterPatient} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Register Patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

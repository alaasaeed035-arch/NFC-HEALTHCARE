import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Wifi, ChevronRight, Stethoscope, Users, ClipboardList } from 'lucide-react'
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
interface DoctorFormData {
  firstName: string; lastName: string; email: string; password: string
  specialization: string; phoneNumber: string; hospitalId: string
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

  const [hospitals, setHospitals] = useState<{ _id: string; name: string }[]>([])

  const [nfcOpen, setNfcOpen] = useState(false)
  const [scannedPatient, setScannedPatient] = useState<Patient | null>(null)
  const [assignDoctor, setAssignDoctor] = useState('')
  const [assigning, setAssigning] = useState(false)

  const [registerPatientOpen, setRegisterPatientOpen] = useState(false)
  const [registerDoctorOpen, setRegisterDoctorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [patientForm, setPatientForm] = useState<PatientFormData>({
    firstName: '', lastName: '', nationalId: '', gender: '', dateOfBirth: '',
    bloodType: '', phoneNumber: '', address: '', cardId: '',
    ecName: '', ecPhone: '', ecRelation: '',
  })
  const [doctorForm, setDoctorForm] = useState<DoctorFormData>({
    firstName: '', lastName: '', email: '', password: '', specialization: '', phoneNumber: '', hospitalId: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, dRes, hRes] = await Promise.allSettled([
        client.get('/admin-hospital/patients'),
        client.get('/admin-hospital/doctors'),
        client.get('/hospital/public'),
      ])
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setPatients(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
      if (hRes.status === 'fulfilled') {
        const d = hRes.value.data
        setHospitals(Array.isArray(d) ? d : d.data ?? [])
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

  const validateDoctorForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!doctorForm.firstName.trim()) errs.firstName = 'Required'
    if (!doctorForm.lastName.trim()) errs.lastName = 'Required'
    if (!doctorForm.email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doctorForm.email)) errs.email = 'Invalid email'
    if (!doctorForm.password || doctorForm.password.length < 6) errs.password = 'Min 6 characters'
    if (!doctorForm.hospitalId) errs.hospitalId = 'Required'
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
        bloodType: patientForm.bloodType,
        phoneNumber: patientForm.phoneNumber,
        address: patientForm.address,
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
        bloodType: '', phoneNumber: '', address: '',
      })
      fetchAll()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to register patient', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterDoctor = async () => {
    if (!validateDoctorForm()) return
    setSubmitting(true)
    try {
      await client.post('/auth/signup/doctor', doctorForm)
      toast({ title: 'Doctor registered successfully', variant: 'success' })
      setRegisterDoctorOpen(false)
      setDoctorForm({ firstName: '', lastName: '', email: '', password: '', specialization: '', phoneNumber: '', hospitalId: '' })
      fetchAll()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to register doctor', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const pf = (field: keyof PatientFormData, value: string) => {
    setPatientForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }
  const df = (field: keyof DoctorFormData, value: string) => {
    setDoctorForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
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
                      <TableHead>Gender</TableHead>
                      <TableHead>Blood Type</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No patients found
                        </TableCell>
                      </TableRow>
                    ) : filteredPatients.map(p => (
                      <TableRow key={p._id}>
                        <TableCell>
                          <div className="font-medium">{p.firstName} {p.lastName}</div>
                        </TableCell>
                        <TableCell>{p.nationalId}</TableCell>
                        <TableCell>{p.gender}</TableCell>
                        <TableCell>
                          {p.bloodType && <Badge variant="secondary">{p.bloodType}</Badge>}
                        </TableCell>
                        <TableCell>{p.phoneNumber ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Registered Doctors ({doctors.length})</CardTitle>
                <Button onClick={() => setRegisterDoctorOpen(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Register Doctor
                </Button>
              </div>
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

      {/* Register Patient Dialog */}
      <Dialog
        open={registerPatientOpen}
        onOpenChange={v => {
          setRegisterPatientOpen(v)
          if (!v) {
            setPatientForm({
              firstName: '', lastName: '', nationalId: '', gender: '', dateOfBirth: '',
              bloodType: '', phoneNumber: '', address: '',
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
              <Input value={patientForm.cardId} onChange={e => pf('cardId', e.target.value)} placeholder="Card ID (optional)" />
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

      {/* Register Doctor Dialog */}
      <Dialog
        open={registerDoctorOpen}
        onOpenChange={v => {
          setRegisterDoctorOpen(v)
          if (!v) {
            setDoctorForm({ firstName: '', lastName: '', email: '', password: '', specialization: '', phoneNumber: '', hospitalId: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Doctor</DialogTitle>
            <DialogDescription>Fill in the doctor details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name *" error={formErrors.firstName}>
                <Input value={doctorForm.firstName} onChange={e => df('firstName', e.target.value)} placeholder="First name" />
              </FormField>
              <FormField label="Last Name *" error={formErrors.lastName}>
                <Input value={doctorForm.lastName} onChange={e => df('lastName', e.target.value)} placeholder="Last name" />
              </FormField>
            </div>
            <FormField label="Email *" error={formErrors.email}>
              <Input type="email" value={doctorForm.email} onChange={e => df('email', e.target.value)} placeholder="doctor@hospital.com" />
            </FormField>
            <FormField label="Password *" error={formErrors.password}>
              <Input type="password" value={doctorForm.password} onChange={e => df('password', e.target.value)} placeholder="Min 6 characters" />
            </FormField>
            <FormField label="Specialization" error="">
              <Input value={doctorForm.specialization} onChange={e => df('specialization', e.target.value)} placeholder="e.g., Cardiology" />
            </FormField>
            <FormField label="Phone Number" error="">
              <Input value={doctorForm.phoneNumber} onChange={e => df('phoneNumber', e.target.value)} placeholder="Phone" />
            </FormField>
            <FormField label="Hospital *" error={formErrors.hospitalId}>
              <Select value={doctorForm.hospitalId} onValueChange={v => df('hospitalId', v)}>
                <SelectTrigger><SelectValue placeholder="Select hospital..." /></SelectTrigger>
                <SelectContent>
                  {hospitals.map(h => (
                    <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterDoctorOpen(false)}>Cancel</Button>
            <Button onClick={handleRegisterDoctor} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Register Doctor'}
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

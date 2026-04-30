import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, Trash2, Users, Stethoscope, LayoutDashboard, UserCog, ShieldAlert, Eye, MapPin, Phone, CreditCard, Contact, Mail, ShieldCheck, Clock } from 'lucide-react'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Receptionist, Doctor, Patient, WorkingHours, WeekDay } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface ReceptionistForm {
  firstName: string; lastName: string; email: string; password: string; phoneNumber: string
}

export default function StaffManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'receptionists', 'doctors', 'patients']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'overview'
  const { toast } = useToast()
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteDoctorId, setDeleteDoctorId] = useState<string | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState(false)
  const [viewPatient, setViewPatient] = useState<Patient | null>(null)
  const [searchPatient, setSearchPatient] = useState('')
  const [otpDialogOpen, setOtpDialogOpen] = useState(false)
  const [otpTargetId, setOtpTargetId] = useState<string | null>(null)
  const [otpTargetEmail, setOtpTargetEmail] = useState<string | null>(null)
  const [otpValue, setOtpValue] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Working hours dialog
  const DAYS: WeekDay[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  type HoursEntry = { day: WeekDay; enabled: boolean; start: string; end: string }
  const [hoursDoctor, setHoursDoctor] = useState<Doctor | null>(null)
  const [hoursForm, setHoursForm] = useState<HoursEntry[]>([])
  const [savingHours, setSavingHours] = useState(false)

  const openHoursDialog = (d: Doctor) => {
    setHoursDoctor(d)
    setHoursForm(DAYS.map(day => {
      const existing = d.workingHours?.find(h => h.day === day)
      return { day, enabled: !!existing, start: existing?.start ?? '08:00', end: existing?.end ?? '16:00' }
    }))
  }

  const setHoursField = (day: WeekDay, field: 'enabled' | 'start' | 'end', value: string | boolean) =>
    setHoursForm(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h))

  const handleSaveHours = async () => {
    if (!hoursDoctor) return
    setSavingHours(true)
    try {
      const payload = hoursForm.filter(h => h.enabled).map(({ day, start, end }) => ({ day, start, end }))
      const res = await client.put(`/admin-hospital/doctor/${hoursDoctor._id}/working-hours`, { workingHours: payload })
      const updated: WorkingHours[] = res.data?.data?.workingHours ?? payload
      setDoctors(prev => prev.map(d => d._id === hoursDoctor._id ? { ...d, workingHours: updated } : d))
      toast({ title: 'Working hours saved', variant: 'success' })
      setHoursDoctor(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to save working hours', variant: 'error' })
    } finally {
      setSavingHours(false)
    }
  }

  const [form, setForm] = useState<ReceptionistForm>({
    firstName: '', lastName: '', email: '', password: '', phoneNumber: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [rRes, dRes, pRes] = await Promise.allSettled([
        client.get('/admin-hospital/receptionists'),
        client.get('/admin-hospital/doctors'),
        client.get('/admin-hospital/patients'),
      ])
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setReceptionists(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setPatients(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim()) errs.lastName = 'Required'
    if (!form.email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    if (!form.password || form.password.length < 6) errs.password = 'Min 6 characters'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await client.post('/admin-hospital/create-receptionist', form)
      const created = res.data.data
      toast({ title: 'Receptionist created. OTP sent to their email.', variant: 'success' })
      setCreateOpen(false)
      const createdEmail = form.email
      setForm({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' })
      fetchAll()
      // open OTP verification dialog immediately
      setOtpTargetId(created._id)
      setOtpTargetEmail(createdEmail)
      setOtpValue('')
      setOtpDialogOpen(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to create receptionist', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const openOtpDialog = (id: string, email: string) => {
    setOtpTargetId(id)
    setOtpTargetEmail(email)
    setOtpValue('')
    setOtpDialogOpen(true)
  }

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6 || !otpTargetId) return
    setVerifyingOtp(true)
    try {
      await client.post('/admin-hospital/verify-receptionist-otp', {
        receptionistId: otpTargetId,
        otp: otpValue,
      })
      toast({ title: 'Receptionist verified successfully', variant: 'success' })
      setReceptionists(prev => prev.map(r =>
        r._id === otpTargetId ? { ...r, isVerified: true } : r
      ))
      setOtpDialogOpen(false)
      setOtpValue('')
      setOtpTargetId(null)
      setOtpTargetEmail(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Invalid or expired OTP', variant: 'error' })
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    if (!otpTargetId) return
    setResendingOtp(true)
    try {
      await client.post('/admin-hospital/resend-receptionist-otp', { receptionistId: otpTargetId })
      toast({ title: 'OTP resent to email', variant: 'success' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to resend OTP', variant: 'error' })
    } finally {
      setResendingOtp(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await client.delete(`/admin-hospital/receptionist/${deleteId}`)
      toast({ title: 'Receptionist deleted', variant: 'success' })
      setReceptionists(prev => prev.filter(r => r._id !== deleteId))
      setDeleteId(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete receptionist', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteDoctor = async () => {
    if (!deleteDoctorId) return
    setDeletingDoctor(true)
    try {
      await client.delete(`/admin-hospital/doctor/${deleteDoctorId}`)
      toast({ title: 'Doctor deleted', variant: 'success' })
      setDoctors(prev => prev.filter(d => d._id !== deleteDoctorId))
      setDeleteDoctorId(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete doctor', variant: 'error' })
    } finally {
      setDeletingDoctor(false)
    }
  }

  const sf = (field: keyof ReceptionistForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  const stats = [
    { label: 'Total Patients', value: patients.length, icon: Users, color: 'bg-blue-50 text-[#0055BB]' },
    { label: 'Total Doctors', value: doctors.length, icon: Stethoscope, color: 'bg-green-50 text-green-600' },
    { label: 'Receptionists', value: receptionists.length, icon: UserCog, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={tab => navigate(`${location.pathname}#${tab}`, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="receptionists">
            <UserCog className="h-4 w-4 mr-1.5" />Receptionists
          </TabsTrigger>
          <TabsTrigger value="doctors">
            <Stethoscope className="h-4 w-4 mr-1.5" />Doctors
          </TabsTrigger>
          <TabsTrigger value="patients">
            <Users className="h-4 w-4 mr-1.5" />Patients
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {stats.map(stat => {
              const Icon = stat.icon
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {loading ? '—' : stat.value}
                        </p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Recent Doctors</CardTitle></CardHeader>
              <CardContent>
                {loading ? <div className="flex justify-center py-4"><Spinner /></div> : (
                  <div className="space-y-2">
                    {doctors.slice(0, 5).map(d => (
                      <div key={d._id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-bold">
                          {d.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Dr. {d.firstName} {d.lastName}</p>
                          <p className="text-xs text-gray-400">{d.specialization ?? 'General'}</p>
                        </div>
                        <Badge variant={d.isVerified ? 'success' : 'secondary'} className="ml-auto">
                          {d.isVerified ? 'Verified' : 'Pending'}
                        </Badge>
                      </div>
                    ))}
                    {doctors.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No doctors</p>}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent Receptionists</CardTitle></CardHeader>
              <CardContent>
                {loading ? <div className="flex justify-center py-4"><Spinner /></div> : (
                  <div className="space-y-2">
                    {receptionists.slice(0, 5).map(r => (
                      <div key={r._id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-bold">
                          {r.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                          <p className="text-xs text-gray-400">{r.email}</p>
                        </div>
                      </div>
                    ))}
                    {receptionists.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No receptionists</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Receptionists Tab */}
        <TabsContent value="receptionists">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Receptionists ({receptionists.length})</CardTitle>
                <Button onClick={() => setCreateOpen(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Create Receptionist
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptionists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                          No receptionists found
                        </TableCell>
                      </TableRow>
                    ) : receptionists.map(r => (
                      <TableRow key={r._id}>
                        <TableCell>
                          <div className="font-medium">{r.firstName} {r.lastName}</div>
                        </TableCell>
                        <TableCell className="text-gray-500">{r.email}</TableCell>
                        <TableCell>
                          {r.isVerified ? (
                            <Badge variant="success" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!r.isVerified && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-blue-400 hover:text-blue-600 h-8 w-8"
                                aria-label="Send OTP"
                                title="Send verification OTP"
                                onClick={() => openOtpDialog(r._id, r.email)}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-400 hover:text-red-600 h-8 w-8"
                              aria-label="Delete receptionist"
                              onClick={() => setDeleteId(r._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        {/* Doctors Tab — grouped by department */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Hospital Doctors ({doctors.length})</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Doctors self-register via the signup page
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : doctors.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No doctors found</p>
              ) : (() => {
                const grouped: Record<string, Doctor[]> = {}
                doctors.forEach(d => {
                  const dept = d.specialization ?? 'General'
                  if (!grouped[dept]) grouped[dept] = []
                  grouped[dept].push(d)
                })
                return (
                  <div className="space-y-6">
                    {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptDoctors]) => (
                      <div key={dept}>
                        <div className="flex items-center gap-2 mb-3">
                          <Stethoscope className="h-4 w-4 text-[#0055BB]" />
                          <h3 className="text-sm font-semibold text-gray-700">{dept}</h3>
                          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                            {deptDoctors.length} doctor{deptDoctors.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {deptDoctors.map(d => (
                            <div key={d._id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    Dr. {d.firstName} {d.lastName}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">{d.email}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Badge variant={d.isVerified ? 'success' : 'secondary'} className="text-xs">
                                    {d.isVerified ? 'Verified' : 'Pending'}
                                  </Badge>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-blue-400 hover:text-blue-600 h-7 w-7"
                                    aria-label="Set working hours"
                                    title="Set working hours"
                                    onClick={() => openHoursDialog(d)}
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-600 h-7 w-7"
                                    aria-label="Delete doctor"
                                    onClick={() => setDeleteDoctorId(d._id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {d.workingHours?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {d.workingHours.map(h => (
                                    <span key={h.day} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                                      {h.day.slice(0, 3)} {h.start}–{h.end}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">No working hours set</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Patients Tab — view only */}
        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle>Hospital Patients ({patients.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <Input
                  placeholder="Search patients..."
                  className="pl-9"
                  value={searchPatient}
                  onChange={e => setSearchPatient(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (() => {
                const q = searchPatient.toLowerCase()
                const filtered = q
                  ? patients.filter(p =>
                      p.firstName.toLowerCase().includes(q) ||
                      p.lastName.toLowerCase().includes(q) ||
                      p.nationalId.toLowerCase().includes(q)
                    )
                  : patients
                return (
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
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-8">No patients found</TableCell>
                        </TableRow>
                      ) : filtered.map(p => (
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-400 hover:text-[#0055BB]"
                              aria-label="View patient details"
                              onClick={() => setViewPatient(p)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              })()}
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
              <div className="rounded-xl bg-gradient-to-br from-[#0055BB] to-[#003380] p-4 text-white">
                <p className="text-xl font-bold">{viewPatient.firstName} {viewPatient.lastName}</p>
                <p className="text-sm opacity-80 mt-0.5">ID: {viewPatient.nationalId}</p>
                <div className="flex items-center gap-4 mt-2 text-sm opacity-90">
                  <span>{viewPatient.gender}</span>
                  {viewPatient.bloodType && <Badge className="bg-white/20 text-white border-0">{viewPatient.bloodType}</Badge>}
                  {viewPatient.dateOfBirth && <span>DOB: {viewPatient.dateOfBirth}</span>}
                </div>
              </div>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title="Delete Receptionist"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deleteDoctorId}
        onOpenChange={open => { if (!open) setDeleteDoctorId(null) }}
        title="Delete Doctor"
        description="This will permanently remove the doctor from your hospital. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteDoctor}
        loading={deletingDoctor}
      />

      {/* Working Hours Dialog */}
      <Dialog open={!!hoursDoctor} onOpenChange={open => { if (!open) setHoursDoctor(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0055BB]" />
              Working Hours — Dr. {hoursDoctor?.firstName} {hoursDoctor?.lastName}
            </DialogTitle>
            <DialogDescription>Check the days this doctor works and set their shift times</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {hoursForm.map(entry => (
              <div key={entry.day} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${entry.enabled ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                <input
                  type="checkbox"
                  id={`day-${entry.day}`}
                  checked={entry.enabled}
                  onChange={e => setHoursField(entry.day, 'enabled', e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0055BB] cursor-pointer"
                />
                <label htmlFor={`day-${entry.day}`} className="w-24 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  {entry.day}
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={entry.start}
                    disabled={!entry.enabled}
                    onChange={e => setHoursField(entry.day, 'start', e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#0055BB]"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={entry.end}
                    disabled={!entry.enabled}
                    onChange={e => setHoursField(entry.day, 'end', e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#0055BB]"
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoursDoctor(null)}>Cancel</Button>
            <Button onClick={handleSaveHours} disabled={savingHours}>
              {savingHours ? <Spinner size="sm" /> : 'Save Hours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog
        open={otpDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setOtpDialogOpen(false)
            setOtpValue('')
            setOtpTargetId(null)
            setOtpTargetEmail(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify Receptionist</DialogTitle>
            <DialogDescription>
              An OTP was sent to{' '}
              <span className="font-medium text-gray-800">{otpTargetEmail}</span>.
              Enter the 6-digit code to activate the account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <OtpInput value={otpValue} onChange={setOtpValue} />
            <Button
              className="w-full"
              onClick={handleVerifyOtp}
              disabled={otpValue.length !== 6 || verifyingOtp}
            >
              {verifyingOtp ? <Spinner size="sm" /> : 'Verify Account'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-[#0055BB] transition-colors disabled:opacity-50"
                disabled={resendingOtp}
                onClick={handleResendOtp}
              >
                {resendingOtp ? 'Resending…' : "Didn't receive a code? Resend OTP"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Receptionist Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={v => {
          setCreateOpen(v)
          if (!v) {
            setForm({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Receptionist</DialogTitle>
            <DialogDescription>Add a new receptionist to your hospital</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={e => sf('firstName', e.target.value)} placeholder="First name" />
                {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={e => sf('lastName', e.target.value)} placeholder="Last name" />
                {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => sf('email', e.target.value)} placeholder="email@hospital.com" />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={e => sf('password', e.target.value)} placeholder="Min 6 characters" />
              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input value={form.phoneNumber} onChange={e => sf('phoneNumber', e.target.value)} placeholder="Phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (i: number, raw: string) => {
    if (!/^\d*$/.test(raw)) return
    const digits = value.padEnd(6, ' ').split('')
    digits[i] = raw.slice(-1)
    const next = digits.join('').trimEnd()
    onChange(next)
    if (raw && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      onChange(pasted)
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-12 w-10 rounded-lg border border-gray-300 bg-white text-center text-xl font-bold text-gray-800 shadow-sm transition-colors focus:border-[#0055BB] focus:outline-none focus:ring-2 focus:ring-[#0055BB]/20"
        />
      ))}
    </div>
  )
}

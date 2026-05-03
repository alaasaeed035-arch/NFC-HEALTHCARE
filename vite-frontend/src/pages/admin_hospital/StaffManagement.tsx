import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, Trash2, Stethoscope, LayoutDashboard, UserCog, ShieldAlert, Mail, ShieldCheck, Clock, Beaker, Building2, Plus } from 'lucide-react'
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
import type { Receptionist, Doctor, WorkingHours, WeekDay } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface StaffForm {
  firstName: string; lastName: string; email: string; password: string; phoneNumber: string
}

// Re-use the same shape for both receptionist and pharmacist
type ReceptionistForm = StaffForm

export default function StaffManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'receptionists', 'pharmacists', 'doctors', 'departments']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'overview'
  const { toast } = useToast()
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [pharmacists, setPharmacists] = useState<Receptionist[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [createType, setCreateType] = useState<'receptionist' | 'pharmacist'>('receptionist')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletePharmacistId, setDeletePharmacistId] = useState<string | null>(null)
  const [deletingPharmacist, setDeletingPharmacist] = useState(false)
  const [deleteDoctorId, setDeleteDoctorId] = useState<string | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState(false)
  const [otpDialogOpen, setOtpDialogOpen] = useState(false)
  const [otpType, setOtpType] = useState<'receptionist' | 'pharmacist'>('receptionist')
  const [otpTargetId, setOtpTargetId] = useState<string | null>(null)
  const [otpTargetEmail, setOtpTargetEmail] = useState<string | null>(null)
  const [otpValue, setOtpValue] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Departments
  interface Department { name: string; floor: string }
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptForm, setDeptForm] = useState({ name: '', floor: '' })
  const [deptFormErrors, setDeptFormErrors] = useState<{ name?: string }>({})
  const [addingDept, setAddingDept] = useState(false)
  const [deleteDeptName, setDeleteDeptName] = useState<string | null>(null)
  const [deletingDept, setDeletingDept] = useState(false)

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
      const [rRes, phRes, dRes, deptRes] = await Promise.allSettled([
        client.get('/admin-hospital/receptionists'),
        client.get('/admin-hospital/pharmacists'),
        client.get('/admin-hospital/doctors'),
        client.get('/admin-hospital/departments'),
      ])
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setReceptionists(Array.isArray(d) ? d : d.data ?? [])
      }
      if (phRes.status === 'fulfilled') {
        const d = phRes.value.data
        setPharmacists(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
      if (deptRes.status === 'fulfilled') {
        setDepartments(deptRes.value.data.data ?? [])
      } else {
        const e = deptRes.reason as { response?: { data?: { message?: string } }; message?: string }
        console.error('Departments fetch failed:', e?.response?.data?.message ?? e?.message)
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
      const endpoint = createType === 'pharmacist'
        ? '/admin-hospital/create-pharmacist'
        : '/admin-hospital/create-receptionist'
      const res = await client.post(endpoint, form)
      const created = res.data.data
      const label = createType === 'pharmacist' ? 'Pharmacist' : 'Receptionist'
      toast({ title: `${label} created. OTP sent to their email.`, variant: 'success' })
      setCreateOpen(false)
      const createdEmail = form.email
      setForm({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' })
      fetchAll()
      setOtpType(createType)
      setOtpTargetId(created._id)
      setOtpTargetEmail(createdEmail)
      setOtpValue('')
      setOtpDialogOpen(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? `Failed to create ${createType}`, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const openOtpDialog = (id: string, email: string, type: 'receptionist' | 'pharmacist' = 'receptionist') => {
    setOtpType(type)
    setOtpTargetId(id)
    setOtpTargetEmail(email)
    setOtpValue('')
    setOtpDialogOpen(true)
  }

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6 || !otpTargetId) return
    setVerifyingOtp(true)
    try {
      if (otpType === 'pharmacist') {
        await client.post('/admin-hospital/verify-pharmacist-otp', { pharmacistId: otpTargetId, otp: otpValue })
        toast({ title: 'Pharmacist verified successfully', variant: 'success' })
        setPharmacists(prev => prev.map(p => p._id === otpTargetId ? { ...p, isVerified: true } : p))
      } else {
        await client.post('/admin-hospital/verify-receptionist-otp', { receptionistId: otpTargetId, otp: otpValue })
        toast({ title: 'Receptionist verified successfully', variant: 'success' })
        setReceptionists(prev => prev.map(r => r._id === otpTargetId ? { ...r, isVerified: true } : r))
      }
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
      if (otpType === 'pharmacist') {
        await client.post('/admin-hospital/resend-pharmacist-otp', { pharmacistId: otpTargetId })
      } else {
        await client.post('/admin-hospital/resend-receptionist-otp', { receptionistId: otpTargetId })
      }
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

  const handleDeletePharmacist = async () => {
    if (!deletePharmacistId) return
    setDeletingPharmacist(true)
    try {
      await client.delete(`/admin-hospital/pharmacist/${deletePharmacistId}`)
      toast({ title: 'Pharmacist deleted', variant: 'success' })
      setPharmacists(prev => prev.filter(p => p._id !== deletePharmacistId))
      setDeletePharmacistId(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete pharmacist', variant: 'error' })
    } finally {
      setDeletingPharmacist(false)
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

  const handleAddDepartment = async () => {
    if (!deptForm.name.trim()) {
      setDeptFormErrors({ name: 'Required' })
      return
    }
    setDeptFormErrors({})
    setAddingDept(true)
    try {
      const res = await client.post('/admin-hospital/departments', deptForm)
      setDepartments(res.data.data)
      setDeptForm({ name: '', floor: '' })
      toast({ title: 'Department added', variant: 'success' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to add department', variant: 'error' })
    } finally {
      setAddingDept(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!deleteDeptName) return
    setDeletingDept(true)
    try {
      const res = await client.delete(`/admin-hospital/departments/${encodeURIComponent(deleteDeptName)}`)
      setDepartments(res.data.data)
      toast({ title: 'Department deleted', variant: 'success' })
      setDeleteDeptName(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete department', variant: 'error' })
    } finally {
      setDeletingDept(false)
    }
  }

  const sf = (field: keyof ReceptionistForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  const stats = [
    { label: 'Total Doctors', value: doctors.length, icon: Stethoscope, color: 'bg-green-50 text-green-600' },
    { label: 'Receptionists', value: receptionists.length, icon: UserCog, color: 'bg-purple-50 text-purple-600' },
    { label: 'Pharmacists', value: pharmacists.length, icon: Beaker, color: 'bg-teal-50 text-teal-600' },
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
          <TabsTrigger value="pharmacists">
            <Beaker className="h-4 w-4 mr-1.5" />Pharmacists
          </TabsTrigger>
          <TabsTrigger value="doctors">
            <Stethoscope className="h-4 w-4 mr-1.5" />Doctors
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Building2 className="h-4 w-4 mr-1.5" />Departments
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
                <Button onClick={() => { setCreateType('receptionist'); setCreateOpen(true) }} size="sm">
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
                                onClick={() => openOtpDialog(r._id, r.email, 'receptionist')}
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

        {/* Pharmacists Tab */}
        <TabsContent value="pharmacists">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Pharmacists ({pharmacists.length})</CardTitle>
                <Button onClick={() => { setCreateType('pharmacist'); setCreateOpen(true) }} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Create Pharmacist
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
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pharmacists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No pharmacists yet — click "Create Pharmacist" to add one
                        </TableCell>
                      </TableRow>
                    ) : pharmacists.map(p => (
                      <TableRow key={p._id}>
                        <TableCell>
                          <div className="font-medium">{p.firstName} {p.lastName}</div>
                        </TableCell>
                        <TableCell className="text-gray-500">{p.email}</TableCell>
                        <TableCell className="text-gray-500">{(p as unknown as { phoneNumber?: string }).phoneNumber ?? '—'}</TableCell>
                        <TableCell>
                          {p.isVerified ? (
                            <Badge variant="success" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!p.isVerified && (
                              <Button
                                size="icon" variant="ghost"
                                className="text-blue-400 hover:text-blue-600 h-8 w-8"
                                title="Send verification OTP"
                                onClick={() => openOtpDialog(p._id, p.email, 'pharmacist')}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon" variant="ghost"
                              className="text-red-400 hover:text-red-600 h-8 w-8"
                              onClick={() => setDeletePharmacistId(p._id)}
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
        {/* Departments Tab */}
        <TabsContent value="departments">
          <div className="space-y-4">
            {/* Add form */}
            <Card>
              <CardHeader><CardTitle>Add Department</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 space-y-1">
                    <Label>Department Name *</Label>
                    <Input
                      placeholder="e.g. Cardiology"
                      value={deptForm.name}
                      onChange={e => { setDeptForm(p => ({ ...p, name: e.target.value })); setDeptFormErrors({}) }}
                    />
                    {deptFormErrors.name && <p className="text-xs text-red-500">{deptFormErrors.name}</p>}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>Floor</Label>
                    <Input
                      placeholder="e.g. 3rd Floor"
                      value={deptForm.floor}
                      onChange={e => setDeptForm(p => ({ ...p, floor: e.target.value }))}
                    />
                  </div>
                  <div className="pt-6">
                    <Button onClick={handleAddDepartment} disabled={addingDept}>
                      {addingDept ? <Spinner size="sm" /> : <><Plus className="h-4 w-4 mr-1.5" />Add</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Departments list */}
            <Card>
              <CardHeader><CardTitle>Departments ({departments.length})</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : departments.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No departments yet — add one above</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Floor</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map(dept => (
                        <TableRow key={dept.name}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                                <Building2 className="h-4 w-4 text-[#0055BB]" />
                              </div>
                              <span className="font-medium text-gray-900">{dept.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-500">{dept.floor || <span className="text-gray-300">—</span>}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-400 hover:text-red-600 h-8 w-8"
                              aria-label="Delete department"
                              onClick={() => setDeleteDeptName(dept.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
        open={!!deletePharmacistId}
        onOpenChange={open => { if (!open) setDeletePharmacistId(null) }}
        title="Delete Pharmacist"
        description="This will permanently remove the pharmacist from your hospital."
        confirmLabel="Delete"
        onConfirm={handleDeletePharmacist}
        loading={deletingPharmacist}
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

      <ConfirmDialog
        open={!!deleteDeptName}
        onOpenChange={open => { if (!open) setDeleteDeptName(null) }}
        title="Delete Department"
        description={`Remove the "${deleteDeptName}" department? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteDepartment}
        loading={deletingDept}
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
            <DialogTitle>Verify {otpType === 'pharmacist' ? 'Pharmacist' : 'Receptionist'}</DialogTitle>
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
            <DialogTitle>
              {createType === 'pharmacist' ? 'Create Pharmacist' : 'Create Receptionist'}
            </DialogTitle>
            <DialogDescription>
              {createType === 'pharmacist'
                ? 'Add a new pharmacist to your hospital. They will receive an OTP email to verify their account.'
                : 'Add a new receptionist to your hospital. They will receive an OTP email to verify their account.'}
            </DialogDescription>
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

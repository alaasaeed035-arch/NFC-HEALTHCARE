import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Building2, UserPlus, Pencil, Trash2, Phone, MapPin, Mail,
  Users, Stethoscope, UserCog, LayoutDashboard, Search
} from 'lucide-react'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Hospital, Patient, Doctor } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface ReceptionistRow {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  hospitalId?: { _id: string; name: string }
}

interface HospitalForm {
  name: string; address: string; phoneNumber: string; email: string; hotline: string; licenseNumber: string
}
interface AdminForm {
  fullName: string; email: string; password: string; phoneNumber: string; hospitalId: string
}

export default function FacilityManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'hospitals', 'admins']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'hospitals'
  const { toast } = useToast()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [hospitalAdmins, setHospitalAdmins] = useState<{ _id: string; fullName: string; email: string; phoneNumber?: string; hospitalId?: { _id: string; name: string } }[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [receptionists, setReceptionists] = useState<ReceptionistRow[]>([])
  const [overviewSearch, setOverviewSearch] = useState('')
  const [overviewRoleFilter, setOverviewRoleFilter] = useState<'all' | 'patient' | 'doctor' | 'receptionist'>('all')
  const [loading, setLoading] = useState(true)
  const [hospitalDialogOpen, setHospitalDialogOpen] = useState(false)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [hospitalForm, setHospitalForm] = useState<HospitalForm>({
    name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '',
  })
  const [adminForm, setAdminForm] = useState<AdminForm>({
    fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchHospitals()
  }, [])

  const fetchHospitals = async () => {
    setLoading(true)
    try {
      const [hRes, aRes, pRes, dRes, rRes] = await Promise.allSettled([
        client.get('/hospital'),
        client.get('/admin/hospital-admins'),
        client.get('/auth/patients'),
        client.get('/auth/doctors'),
        client.get('/auth/receptionists'),
      ])
      if (hRes.status === 'fulfilled') {
        const d = hRes.value.data
        setHospitals(Array.isArray(d) ? d : d.data ?? [])
      }
      if (aRes.status === 'fulfilled') {
        const d = aRes.value.data
        setHospitalAdmins(Array.isArray(d) ? d : d.data ?? [])
      }
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setPatients(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setReceptionists(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const validateHospital = () => {
    const errs: Record<string, string> = {}
    if (!hospitalForm.name.trim()) errs.name = 'Required'
    if (!hospitalForm.address.trim()) errs.address = 'Required'
    if (!hospitalForm.phoneNumber.trim()) errs.phoneNumber = 'Required'
    if (!hospitalForm.email.trim()) errs.email = 'Required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }
  const validateAdmin = () => {
    const errs: Record<string, string> = {}
    if (!adminForm.fullName.trim()) errs.fullName = 'Required'
    if (!adminForm.email.trim()) errs.email = 'Required'
    if (!adminForm.password || adminForm.password.length < 6) errs.password = 'Min 6 characters'
    if (!adminForm.hospitalId) errs.hospitalId = 'Required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveHospital = async () => {
    if (!validateHospital()) return
    setSubmitting(true)
    try {
      if (editingHospital) {
        await client.put(`/hospital/update/${editingHospital._id}`, hospitalForm)
        toast({ title: 'Hospital updated successfully', variant: 'success' })
      } else {
        await client.post('/hospital/create', hospitalForm)
        toast({ title: 'Hospital onboarded successfully', variant: 'success' })
      }
      setHospitalDialogOpen(false)
      setEditingHospital(null)
      setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' })
      fetchHospitals()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to save hospital', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteHospital = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await client.delete(`/hospital/delete/${deleteId}`)
      toast({ title: 'Hospital deleted', variant: 'success' })
      setHospitals(prev => prev.filter(h => h._id !== deleteId))
      setDeleteId(null)
    } catch {
      toast({ title: 'Failed to delete hospital', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!deleteAdminId) return
    setDeletingAdmin(true)
    try {
      await client.delete(`/admin/hospital-admin/${deleteAdminId}`)
      toast({ title: 'Hospital admin deleted', variant: 'success' })
      setHospitalAdmins(prev => prev.filter(a => a._id !== deleteAdminId))
      setDeleteAdminId(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete admin', variant: 'error' })
    } finally {
      setDeletingAdmin(false)
    }
  }

  const handleEditHospital = (h: Hospital) => {
    setEditingHospital(h)
    setHospitalForm({
      name: h.name, address: h.address, phoneNumber: h.phoneNumber,
      email: h.email, hotline: h.hotline ?? '', licenseNumber: h.licenseNumber ?? '',
    })
    setHospitalDialogOpen(true)
  }

  const handleCreateAdmin = async () => {
    if (!validateAdmin()) return
    setSubmitting(true)
    try {
      await client.post('/admin/create-hospital-admin', {
        fullName: adminForm.fullName,
        email: adminForm.email,
        password: adminForm.password,
        phoneNumber: adminForm.phoneNumber || undefined,
        hospitalId: adminForm.hospitalId,
      })
      toast({ title: 'Hospital admin created', variant: 'success' })
      setAdminDialogOpen(false)
      setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '' })
      fetchHospitals()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to create admin', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const hf = (field: keyof HospitalForm, value: string) => {
    setHospitalForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }
  const af = (field: keyof AdminForm, value: string) => {
    setAdminForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={tab => navigate(`${location.pathname}#${tab}`, { replace: true })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="hospitals">
            <Building2 className="h-4 w-4 mr-1.5" />Hospitals
          </TabsTrigger>
          <TabsTrigger value="admins">
            <UserPlus className="h-4 w-4 mr-1.5" />Hospital Admins
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Stats row */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Patients', value: patients.length, icon: Users, color: 'bg-blue-50 text-[#0055BB]' },
              { label: 'Total Doctors', value: doctors.length, icon: Stethoscope, color: 'bg-green-50 text-green-600' },
              { label: 'Receptionists', value: receptionists.length, icon: UserCog, color: 'bg-purple-50 text-purple-600' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {loading ? <span className="h-8 w-16 bg-gray-100 rounded animate-pulse inline-block" /> : stat.value}
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

          {/* Combined table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>All System Users</CardTitle>
                <div className="flex gap-3 flex-wrap">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9"
                      value={overviewSearch}
                      onChange={e => setOverviewSearch(e.target.value)}
                    />
                  </div>
                  <Select value={overviewRoleFilter} onValueChange={v => setOverviewRoleFilter(v as typeof overviewRoleFilter)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="patient">Patients</SelectItem>
                      <SelectItem value="doctor">Doctors</SelectItem>
                      <SelectItem value="receptionist">Receptionists</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (() => {
                type Row = { _id: string; name: string; email: string; extra: string; role: string }
                const rows: Row[] = [
                  ...(overviewRoleFilter === 'all' || overviewRoleFilter === 'patient'
                    ? patients.map(p => ({
                      _id: p._id,
                      name: `${p.firstName} ${p.lastName}`,
                      email: p.nationalId ?? '—',
                      extra: p.bloodType ?? '—',
                      role: 'patient',
                    }))
                    : []),
                  ...(overviewRoleFilter === 'all' || overviewRoleFilter === 'doctor'
                    ? doctors.map(d => ({
                      _id: d._id,
                      name: `${d.firstName} ${d.lastName}`,
                      email: d.email,
                      extra: d.specialization ?? '—',
                      role: 'doctor',
                    }))
                    : []),
                  ...(overviewRoleFilter === 'all' || overviewRoleFilter === 'receptionist'
                    ? receptionists.map(r => ({
                      _id: r._id,
                      name: `${r.firstName} ${r.lastName}`,
                      email: r.email,
                      extra: r.hospitalId?.name ?? '—',
                      role: 'receptionist',
                    }))
                    : []),
                ]
                const q = overviewSearch.toLowerCase()
                const filtered = q
                  ? rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
                  : rows
                const roleBadgeVariant = (role: string) =>
                  role === 'doctor' ? 'default' : role === 'receptionist' ? 'secondary' : 'outline'
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email / ID</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-400 py-8">No users found</TableCell>
                        </TableRow>
                      ) : filtered.map(row => (
                        <TableRow key={`${row.role}-${row._id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                                {row.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant(row.role)} className="capitalize">{row.role}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 text-xs">{row.email}</TableCell>
                          <TableCell className="text-gray-500 text-xs">{row.extra}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hospitals Tab */}
        <TabsContent value="hospitals">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Healthcare Facilities ({hospitals.length})</CardTitle>
                <Button onClick={() => { setEditingHospital(null); setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' }); setHospitalDialogOpen(true) }} size="sm">
                  <Building2 className="h-4 w-4 mr-1.5" />Onboard Hospital
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : hospitals.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No hospitals registered yet</p>
                  <Button className="mt-4" onClick={() => setHospitalDialogOpen(true)}>
                    Onboard First Hospital
                  </Button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {hospitals.map(h => (
                    <div key={h._id} className="rounded-xl border border-gray-200 p-4 hover:border-[#0055BB]/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                            <Building2 className="h-5 w-5 text-[#0055BB]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{h.name}</p>
                            {h.licenseNumber && (
                              <p className="text-xs text-gray-400">License: {h.licenseNumber}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditHospital(h)}>
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete hospital"
                            onClick={() => setDeleteId(h._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />{h.address}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />{h.phoneNumber}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />{h.email}
                        </div>
                        {h.hotline && (
                          <div className="text-xs font-medium text-red-500">Emergency: {h.hotline}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Hospital Administrators</CardTitle>
                <Button onClick={() => setAdminDialogOpen(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Create Admin
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
                      <TableHead>Hospital</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitalAdmins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No hospital admins yet
                        </TableCell>
                      </TableRow>
                    ) : hospitalAdmins.map(a => (
                      <TableRow key={a._id}>
                        <TableCell className="font-medium">{a.fullName}</TableCell>
                        <TableCell className="text-gray-500">{a.email}</TableCell>
                        <TableCell className="text-gray-500">{a.phoneNumber ?? '—'}</TableCell>
                        <TableCell>{a.hospitalId?.name ?? <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete admin"
                            onClick={() => setDeleteAdminId(a._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title="Delete Hospital"
        description="This will permanently remove the hospital and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteHospital}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deleteAdminId}
        onOpenChange={open => { if (!open) setDeleteAdminId(null) }}
        title="Delete Hospital Admin"
        description="This will permanently remove the hospital admin account and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteAdmin}
        loading={deletingAdmin}
      />

      {/* Hospital Dialog */}
      <Dialog
        open={hospitalDialogOpen}
        onOpenChange={v => {
          setHospitalDialogOpen(v)
          if (!v) {
            setEditingHospital(null)
            setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHospital ? 'Edit Hospital' : 'Onboard New Hospital'}</DialogTitle>
            <DialogDescription>
              {editingHospital ? 'Update hospital details' : 'Register a new healthcare facility'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Hospital Name *</Label>
              <Input value={hospitalForm.name} onChange={e => hf('name', e.target.value)} placeholder="City Medical Center" />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Address *</Label>
              <Input value={hospitalForm.address} onChange={e => hf('address', e.target.value)} placeholder="123 Medical Drive, City" />
              {formErrors.address && <p className="text-xs text-red-500">{formErrors.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone *</Label>
                <Input value={hospitalForm.phoneNumber} onChange={e => hf('phoneNumber', e.target.value)} placeholder="+1 555-0100" />
                {formErrors.phoneNumber && <p className="text-xs text-red-500">{formErrors.phoneNumber}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={hospitalForm.email} onChange={e => hf('email', e.target.value)} placeholder="info@hospital.com" />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Emergency Hotline</Label>
                <Input value={hospitalForm.hotline} onChange={e => hf('hotline', e.target.value)} placeholder="911" />
              </div>
              <div className="space-y-1">
                <Label>License Number</Label>
                <Input value={hospitalForm.licenseNumber} onChange={e => hf('licenseNumber', e.target.value)} placeholder="HOSP-12345" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHospitalDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveHospital} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : editingHospital ? 'Update' : 'Onboard Hospital'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <Dialog
        open={adminDialogOpen}
        onOpenChange={v => {
          setAdminDialogOpen(v)
          if (!v) {
            setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Hospital Admin</DialogTitle>
            <DialogDescription>Add an admin for a hospital facility</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={adminForm.fullName} onChange={e => af('fullName', e.target.value)} placeholder="Admin full name" />
              {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={adminForm.email} onChange={e => af('email', e.target.value)} placeholder="admin@hospital.com" />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={adminForm.password} onChange={e => af('password', e.target.value)} placeholder="Min 6 characters" />
              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input value={adminForm.phoneNumber} onChange={e => af('phoneNumber', e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1">
              <Label>Hospital *</Label>
              <Select value={adminForm.hospitalId} onValueChange={v => af('hospitalId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hospital..." />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map(h => (
                    <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.hospitalId && <p className="text-xs text-red-500">{formErrors.hospitalId}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

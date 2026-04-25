import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Users, Building2, FileText, AlertTriangle, Globe, Trash2,
  Activity, Stethoscope, UserCog, ShieldAlert, Search, UserPlus
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { SeverityBadge } from '@/components/ddi/SeverityBadge'
import { DDITable } from '@/components/ddi/DDITable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/Dialog'
import type { Patient, Doctor, Hospital, MedicalRecord, Role } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface AdminRow {
  _id: string
  fullName: string
  email: string
  phoneNumber?: string
  isVerified?: boolean
}

interface AdminForm {
  fullName: string
  email: string
  password: string
  phoneNumber: string
}

interface UserRow {
  _id: string
  firstName: string
  lastName: string
  email?: string
  nationalId?: string
  role: Role
  specialization?: string
  bloodType?: string
  isVerified?: boolean
}

export default function GlobalOverview() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'users', 'hospitals', 'admins']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'overview'
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string; type: 'user' | 'hospital' | 'record'; role?: Role
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchUsers, setSearchUsers] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [searchHospital, setSearchHospital] = useState('')
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [adminForm, setAdminForm] = useState<AdminForm>({ fullName: '', email: '', password: '', phoneNumber: '' })
  const [adminFormErrors, setAdminFormErrors] = useState<Record<string, string>>({})
  const [submittingAdmin, setSubmittingAdmin] = useState(false)
  const [pendingDeleteAdmin, setPendingDeleteAdmin] = useState<string | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, dRes, hRes, rRes, aRes] = await Promise.allSettled([
        client.get('/auth/patients'),
        client.get('/auth/doctors'),
        client.get('/hospital'),
        client.get('/medical-record'),
        client.get('/admin/admins'),
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
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setRecords(Array.isArray(d) ? d : d.data ?? [])
      }
      if (aRes.status === 'fulfilled') {
        const d = aRes.value.data
        setAdmins(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const validateAdminForm = () => {
    const errs: Record<string, string> = {}
    if (!adminForm.fullName.trim()) errs.fullName = 'Required'
    if (!adminForm.email.trim()) errs.email = 'Required'
    if (!adminForm.password || adminForm.password.length < 6) errs.password = 'Min 6 characters'
    setAdminFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const af = (field: keyof AdminForm, value: string) => {
    setAdminForm(prev => ({ ...prev, [field]: value }))
    setAdminFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleCreateAdmin = async () => {
    if (!validateAdminForm()) return
    setSubmittingAdmin(true)
    try {
      await client.post('/admin/create-admin', {
        fullName: adminForm.fullName,
        email: adminForm.email,
        password: adminForm.password,
        phoneNumber: adminForm.phoneNumber || undefined,
      })
      toast({ title: 'Admin created successfully', variant: 'success' })
      setAdminDialogOpen(false)
      setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '' })
      fetchAll()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to create admin', variant: 'error' })
    } finally {
      setSubmittingAdmin(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!pendingDeleteAdmin) return
    setDeletingAdmin(true)
    try {
      await client.delete(`/admin/admin/${pendingDeleteAdmin}`)
      toast({ title: 'Admin deleted', variant: 'success' })
      setAdmins(prev => prev.filter(a => a._id !== pendingDeleteAdmin))
      setPendingDeleteAdmin(null)
    } catch {
      toast({ title: 'Failed to delete admin', variant: 'error' })
    } finally {
      setDeletingAdmin(false)
    }
  }

  const allUsers: UserRow[] = [
    ...patients.map(p => ({
      _id: p._id,
      firstName: p.firstName,
      lastName: p.lastName,
      nationalId: p.nationalId,
      bloodType: p.bloodType,
      role: 'patient' as Role,
    })),
    ...doctors.map(d => ({
      _id: d._id,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      specialization: d.specialization,
      isVerified: d.isVerified,
      role: 'doctor' as Role,
    })),
  ]

  const filteredUsers = allUsers.filter(u => {
    const q = searchUsers.toLowerCase()
    const name = `${u.firstName} ${u.lastName}`.toLowerCase()
    const identifier = (u.email ?? u.nationalId ?? '').toLowerCase()
    const matchesSearch = name.includes(q) || identifier.includes(q)
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const filteredHospitals = hospitals.filter(h => {
    const q = searchHospital.toLowerCase()
    return h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q)
  })

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    const { id, type, role } = pendingDelete
    setDeleting(true)
    try {
      if (type === 'user') {
        const endpoint = role === 'patient' ? `/auth/patient/${id}` : `/auth/doctor/${id}`
        await client.delete(endpoint)
        toast({ title: 'User deleted', variant: 'success' })
        if (role === 'patient') setPatients(prev => prev.filter(p => p._id !== id))
        else setDoctors(prev => prev.filter(d => d._id !== id))
      } else if (type === 'hospital') {
        await client.delete(`/hospital/${id}`)
        toast({ title: 'Hospital deleted', variant: 'success' })
        setHospitals(prev => prev.filter(h => h._id !== id))
      } else {
        await client.delete(`/medical-record/${id}`)
        toast({ title: 'Record deleted', variant: 'success' })
        setRecords(prev => prev.filter(r => r._id !== id))
      }
      setPendingDelete(null)
    } catch {
      toast({ title: 'Failed to delete', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const criticalRecords = records.filter(r => r.aiAnalysis?.severity === 'critical').length

  const stats = [
    { label: 'Total Patients', value: patients.length, icon: Users, color: 'bg-blue-50 text-[#0055BB]', subLabel: 'Registered' },
    { label: 'Total Doctors', value: doctors.length, icon: Stethoscope, color: 'bg-green-50 text-green-600', subLabel: 'Active' },
    { label: 'Hospitals', value: hospitals.length, icon: Building2, color: 'bg-purple-50 text-purple-600', subLabel: 'Facilities' },
    { label: 'Medical Records', value: records.length, icon: FileText, color: 'bg-orange-50 text-orange-600', subLabel: 'Total' },
  ]

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={open => { if (!open) setPendingDelete(null) }}
        title="Confirm Deletion"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
      <Tabs value={activeTab} onValueChange={tab => navigate(`${location.pathname}#${tab}`, { replace: true })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><Globe className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="hospitals"><Building2 className="h-4 w-4 mr-1.5" />Hospitals</TabsTrigger>
          <TabsTrigger value="admins"><UserCog className="h-4 w-4 mr-1.5" />Admins</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {stats.map(stat => {
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
                        <p className="text-xs text-gray-400 mt-0.5">{stat.subLabel}</p>
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

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0055BB]" />
                Recent Medical Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <div className="space-y-2">
                  {records.slice(0, 8).map(r => {
                    const patient = r.patientId !== null && typeof r.patientId === 'object' ? r.patientId : null
                    const doctor = r.doctorId !== null && typeof r.doctorId === 'object' ? r.doctorId : null
                    return (
                      <div key={r._id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <FileText className="h-4 w-4 text-[#0055BB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.diagnosis}</p>
                          <p className="text-xs text-gray-400">
                            {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                            {doctor ? ` · Dr. ${doctor.firstName} ${doctor.lastName}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.aiAnalysis && <SeverityBadge severity={r.aiAnalysis.severity} showIcon={false} />}
                          <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )
                  })}
                  {records.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No records yet</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users ({allUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9"
                    value={searchUsers}
                    onChange={e => setSearchUsers(e.target.value)}
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="patient">Patients</SelectItem>
                    <SelectItem value="doctor">Doctors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">No users found</TableCell>
                      </TableRow>
                    ) : filteredUsers.map(u => (
                      <TableRow key={u._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                              {u.firstName.charAt(0)}
                            </div>
                            <span className="font-medium">{u.firstName} {u.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'doctor' ? 'default' : 'secondary'} className="capitalize">
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 text-xs">
                          {u.email ?? u.nationalId ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {u.role === 'doctor' ? (u.specialization ?? '—') : (u.bloodType ?? '—')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete user"
                            onClick={() => setPendingDelete({ id: u._id, type: 'user', role: u.role })}
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
        </TabsContent>

        {/* Hospitals Tab */}
        <TabsContent value="hospitals">
          <Card>
            <CardHeader>
              <CardTitle>All Hospitals ({hospitals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search hospitals..."
                  className="pl-9"
                  value={searchHospital}
                  onChange={e => setSearchHospital(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHospitals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">No hospitals</TableCell>
                      </TableRow>
                    ) : filteredHospitals.map(h => (
                      <TableRow key={h._id}>
                        <TableCell><div className="font-medium">{h.name}</div></TableCell>
                        <TableCell className="text-gray-500 text-xs max-w-[150px] truncate">{h.address}</TableCell>
                        <TableCell className="text-gray-500">{h.phoneNumber}</TableCell>
                        <TableCell className="text-gray-500 text-xs">{h.email}</TableCell>
                        <TableCell className="text-gray-400 text-xs">{h.licenseNumber ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete hospital"
                            onClick={() => setPendingDelete({ id: h._id, type: 'hospital' })}
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
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>System Admins ({admins.length})</CardTitle>
                <Button size="sm" onClick={() => setAdminDialogOpen(true)}>
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">No admins found</TableCell>
                      </TableRow>
                    ) : admins.map(a => (
                      <TableRow key={a._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#0055BB]">
                              {a.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{a.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">{a.email}</TableCell>
                        <TableCell className="text-gray-500">{a.phoneNumber ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={a.isVerified ? 'default' : 'secondary'}>
                            {a.isVerified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete admin"
                            onClick={() => setPendingDeleteAdmin(a._id)}
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
        </TabsContent>

      </Tabs>

      {/* Delete Admin Confirm Dialog */}
      <ConfirmDialog
        open={!!pendingDeleteAdmin}
        onOpenChange={open => { if (!open) setPendingDeleteAdmin(null) }}
        title="Delete Admin"
        description="This will permanently remove the admin account. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteAdmin}
        loading={deletingAdmin}
      />

      {/* Create Admin Dialog */}
      <Dialog
        open={adminDialogOpen}
        onOpenChange={v => {
          setAdminDialogOpen(v)
          if (!v) {
            setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '' })
            setAdminFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create System Admin</DialogTitle>
            <DialogDescription>Add a new admin with full facility management access</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={adminForm.fullName} onChange={e => af('fullName', e.target.value)} placeholder="Admin full name" />
              {adminFormErrors.fullName && <p className="text-xs text-red-500">{adminFormErrors.fullName}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={adminForm.email} onChange={e => af('email', e.target.value)} placeholder="admin@system.com" />
              {adminFormErrors.email && <p className="text-xs text-red-500">{adminFormErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={adminForm.password} onChange={e => af('password', e.target.value)} placeholder="Min 6 characters" />
              {adminFormErrors.password && <p className="text-xs text-red-500">{adminFormErrors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input value={adminForm.phoneNumber} onChange={e => af('phoneNumber', e.target.value)} placeholder="Phone number (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={submittingAdmin}>
              {submittingAdmin ? <Spinner size="sm" /> : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

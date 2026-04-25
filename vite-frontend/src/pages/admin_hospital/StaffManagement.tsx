import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, Trash2, Users, Stethoscope, LayoutDashboard, UserCog } from 'lucide-react'
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
import type { Receptionist, Doctor, Patient } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface ReceptionistForm {
  firstName: string; lastName: string; email: string; password: string; phoneNumber: string
}

export default function StaffManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'receptionists', 'doctors']
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
  const [submitting, setSubmitting] = useState(false)
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
      await client.post('/admin-hospital/create-receptionist', form)
      toast({ title: 'Receptionist created successfully', variant: 'success' })
      setCreateOpen(false)
      setForm({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '' })
      fetchAll()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to create receptionist', variant: 'error' })
    } finally {
      setSubmitting(false)
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
    } catch {
      toast({ title: 'Failed to delete receptionist', variant: 'error' })
    } finally {
      setDeleting(false)
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
                      <TableHead>Hospital ID</TableHead>
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
                        <TableCell className="text-gray-400 text-xs">{r.hospitalId}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-400 hover:text-red-600 h-8 w-8"
                            aria-label="Delete receptionist"
                            onClick={() => setDeleteId(r._id)}
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

        {/* Doctors Tab */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Hospital Doctors ({doctors.length})</CardTitle>
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
                      <TableHead>Specialization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                          No doctors found
                        </TableCell>
                      </TableRow>
                    ) : doctors.map(d => (
                      <TableRow key={d._id}>
                        <TableCell>
                          <div className="font-medium">Dr. {d.firstName} {d.lastName}</div>
                        </TableCell>
                        <TableCell className="text-gray-500">{d.email}</TableCell>
                        <TableCell>{d.specialization ?? '—'}</TableCell>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title="Delete Receptionist"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />

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

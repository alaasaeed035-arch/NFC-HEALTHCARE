import React, { useEffect, useState } from 'react'
import {
  User, Droplets, Calendar, Phone, MapPin, Heart, Pill, Scissors,
  Building2, AlertTriangle, CreditCard, FileText, Clock,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SeverityBadge } from '@/components/ddi/SeverityBadge'
import { DDITable } from '@/components/ddi/DDITable'
import { useAuth } from '@/hooks/useAuth'
import type { Patient, MedicalRecord, Hospital, Doctor, Medication } from '@/types'
import client from '@/api/client'

export default function HealthPassport() {
  const { user } = useAuth()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const profileRes = await client.get('/auth/me')
        const recordsRes = await client.get('/medical-record')
        const hospitalsRes = await client.get('/hospital')
        
        const d = profileRes.data
        setPatient(d.data ?? d)
        
        const r = recordsRes.data
        setRecords(Array.isArray(r) ? r : r.data ?? [])
        
        const h = hospitalsRes.data
        setHospitals(Array.isArray(h) ? h : h.data ?? [])
      } catch (e) {
        setError('Failed to load health passport data')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Spinner size="lg" />
    </div>
  )
  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!patient) return <p className="text-gray-500 text-sm">No patient data found</p>

  const allMedications: (Medication & { recordDate: string })[] = records.flatMap(r =>
    r.medications.map(m => ({ ...m, recordDate: r.createdAt }))
  )

  const getDoctor = (doc: Doctor | string) => typeof doc === 'string' ? null : doc
  const getHospital = (h: Hospital | string) => typeof h === 'string' ? null : h

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* NFC Identity Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#0055BB] via-[#0044a0] to-[#003380] p-6 text-white overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-10 -translate-x-10" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5 opacity-80">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-medium tracking-widest uppercase">NFC Health Passport</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
              <User className="h-10 w-10" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-1">
                {patient.firstName} {patient.lastName}
              </h2>
              <p className="text-blue-200 text-sm mb-4">National ID: {patient.nationalId}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <InfoChip icon={<Droplets className="h-4 w-4" />} label="Blood Type" value={patient.bloodType ?? 'Unknown'} highlight />
                <InfoChip icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={new Date(patient.dateOfBirth).toLocaleDateString()} />
                <InfoChip icon={<User className="h-4 w-4" />} label="Gender" value={patient.gender} />
                {patient.phoneNumber && (
                  <InfoChip icon={<Phone className="h-4 w-4" />} label="Phone" value={patient.phoneNumber} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide mb-2">
              <MapPin className="h-3.5 w-3.5" />Address
            </div>
            {patient.address
              ? <p className="text-sm text-gray-800">{patient.address}</p>
              : <p className="text-sm text-gray-400 italic">Not provided</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide mb-2">
              <CreditCard className="h-3.5 w-3.5" />NFC Card ID
            </div>
            {patient.cardId
              ? <p className="text-sm text-gray-800 font-mono break-all">{patient.cardId}</p>
              : <p className="text-sm text-gray-400 italic">No card linked</p>}
          </CardContent>
        </Card>

        <Card className={patient.emergencyContact ? 'border-red-100' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-red-400 uppercase tracking-wide mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />Emergency Contact
            </div>
            {patient.emergencyContact ? (
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-800">{patient.emergencyContact.name}</p>
                <p className="text-xs text-gray-500">{patient.emergencyContact.relation}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />{patient.emergencyContact.phone}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Not provided</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="history">Medical History</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="surgeries">Surgeries</TabsTrigger>
          <TabsTrigger value="ddi">DDI Reports</TabsTrigger>
          <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
        </TabsList>

        {/* Medical History */}
        <TabsContent value="history">
          {records.length === 0 ? (
            <EmptyState icon={<FileText className="h-10 w-10 text-gray-300" />} label="No medical records found" />
          ) : (
            <div className="space-y-4">
              {records.map(record => {
                const doc = getDoctor(record.doctorId as Doctor | string)
                const hosp = getHospital(record.hospitalId as Hospital | string)
                return (
                  <Card key={record._id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                            <Heart className="h-5 w-5 text-[#0055BB]" />
                          </div>
                          <div>
                            <CardTitle>{record.diagnosis}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {doc && (
                                <span className="text-xs text-gray-500">
                                  Dr. {doc.firstName} {doc.lastName}
                                  {doc.specialization && ` · ${doc.specialization}`}
                                </span>
                              )}
                              {hosp && (
                                <span className="text-xs text-gray-500">· {hosp.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {record.aiAnalysis && (
                            <SeverityBadge severity={record.aiAnalysis.severity} />
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {new Date(record.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {record.treatment && (
                        <p className="text-sm text-gray-700 mb-3">
                          <span className="font-medium">Treatment:</span> {record.treatment}
                        </p>
                      )}
                      {record.medications.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Medications</p>
                          <div className="flex flex-wrap gap-2">
                            {record.medications.map((med, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-xs font-medium">
                                <Pill className="h-3 w-3" />
                                {med.name} {med.dosage || med.dose || ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {record.aiAnalysis && record.aiAnalysis.hasConflict && (
                        <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 p-3">
                          <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold mb-1">
                            <AlertTriangle className="h-4 w-4" />
                            AI Drug Interaction Alert
                          </div>
                          <p className="text-xs text-orange-700">{record.aiAnalysis.analysis}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Medications */}
        <TabsContent value="medications">
          {allMedications.length === 0 ? (
            <EmptyState icon={<Pill className="h-10 w-10 text-gray-300" />} label="No medications on record" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allMedications.map((med, i) => (
                <Card key={`${med.name}_${i}`}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Pill className="h-5 w-5 text-[#0055BB]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{med.name}</p>
                        <p className="text-sm text-gray-500">{med.dosage || med.dose || ''}</p>
                        {med.duration && (
                          <p className="text-xs text-gray-400 mt-1">Duration: {med.duration}</p>
                        )}
                        {med.notes && (
                          <p className="text-xs text-gray-400 mt-1">{med.notes}</p>
                        )}
                        <p className="text-xs text-gray-300 mt-2">
                          {new Date(med.recordDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Surgeries */}
        <TabsContent value="surgeries">
          {!patient.surgerys || patient.surgerys.length === 0 ? (
            <EmptyState icon={<Scissors className="h-10 w-10 text-gray-300" />} label="No surgical history" />
          ) : (
            <Card>
              <CardContent className="pt-5">
                <ul className="space-y-3">
                  {patient.surgerys.map((surgery, i) => (
                    <li key={`${surgery}_${i}`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                        <Scissors className="h-4 w-4 text-red-500" />
                      </div>
                      <span className="text-sm text-gray-800">{surgery}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {patient.ChronicDiseases && patient.ChronicDiseases.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Chronic Diseases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {patient.ChronicDiseases.map((d, i) => (
                    <Badge key={`${d}_${i}`} variant="destructive">{d}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DDI Reports */}
        <TabsContent value="ddi">
          <DDITable patientId={patient._id} />
        </TabsContent>

        {/* Hospitals Near Me */}
        <TabsContent value="hospitals">
          {hospitals.length === 0 ? (
            <EmptyState icon={<Building2 className="h-10 w-10 text-gray-300" />} label="No hospitals found" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {hospitals.map(h => (
                <Card key={h._id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Building2 className="h-5 w-5 text-[#0055BB]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{h.name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <MapPin className="h-3 w-3" />
                          {h.address}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Phone className="h-3 w-3" />
                          {h.phoneNumber}
                        </div>
                        {h.hotline && (
                          <div className="text-xs text-red-500 mt-1 font-medium">
                            Emergency: {h.hotline}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  )
}

function InfoChip({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-1 opacity-60 text-xs mb-0.5">{icon}{label}</div>
      <p className={`font-semibold ${highlight ? 'text-xl' : 'text-sm'}`}>{value}</p>
    </div>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon}
      <p className="mt-3 text-sm text-gray-400">{label}</p>
    </div>
  )
}

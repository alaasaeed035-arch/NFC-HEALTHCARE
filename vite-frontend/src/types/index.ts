export type Role = 'super_admin' | 'admin' | 'admin_hospital' | 'receptionist' | 'doctor' | 'patient' | 'pharmacist'

export interface AuthUser {
  _id: string
  id?: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  role: Role
  hospitalId?: string
  specialization?: string
}

export interface Patient {
  _id: string
  id?: string
  firstName: string
  lastName: string
  nationalId: string
  gender: string
  dateOfBirth: string
  bloodType?: string
  phoneNumber?: string
  address?: string
  emergencyContact?: { name: string; phone: string; relation: string }
  cardId?: string
  surgerys?: string[]
  ChronicDiseases?: string[]
  role: 'patient'
  createdAt?: string
}

export type WeekDay = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

export interface WorkingHours {
  day: WeekDay
  start: string // "08:00"
  end: string   // "16:00"
}

export interface Doctor {
  _id: string
  firstName: string
  lastName: string
  email: string
  specialization?: string
  phoneNumber?: string
  hospitalId?: string
  role: 'doctor'
  isVerified?: boolean
  workingHours?: WorkingHours[]
}

export interface Hospital {
  _id: string
  name: string
  address: string
  phoneNumber: string
  email: string
  hotline?: string
  licenseNumber?: string
  departments?: { name: string; floor: string }[]
  createdAt?: string
}

export interface Medication {
  name: string
  dosage: string
  dose?: string  // legacy field name (some DB records use 'dose' instead of 'dosage')
  duration: string
  notes?: string
}

export interface AIAnalysis {
  hasConflict: boolean
  severity: DDISeverity
  analysis: string
  recommendations: string[]
  interactions: string[]
  checkedAt?: string
  serviceAvailable?: boolean
}

export interface MedicalRecord {
  _id: string
  patientId: Patient | string
  doctorId: Doctor | string
  hospitalId: Hospital | string
  diagnosis: string
  treatment?: string
  medications: Medication[]
  visitDate?: string
  aiAnalysis?: AIAnalysis
  createdAt: string
}

export type DDISeverity = 'critical' | 'high' | 'moderate' | 'low' | 'none' | 'unknown'

export interface DDIReport {
  _id: string
  patient_id: string
  patient_name?: string
  patient_age?: number
  current_medications?: { name: string; dosage: string; frequency: string; notes?: string }[]
  new_treatment?: { name: string; dosage: string; frequency: string; notes?: string }
  analysis: {
    has_conflict: boolean
    severity: DDISeverity
    analysis: string
    recommendations: string[]
    interactions: string[]
  }
  fda_info?: Record<string, unknown>
  created_at: string
  groq_model?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Receptionist {
  _id: string
  firstName: string
  lastName: string
  email: string
  hospitalId: string
  role: 'receptionist'
  isVerified?: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  count?: number
  total?: number
}

export interface PharmacyInventoryItem {
  _id: string
  hospitalId: string
  name: string
  genericName?: string
  dosageForms?: string[]
  quantityInStock: number
  unit?: string
  manufacturer?: string
  expiryDate?: string
  pricePerUnit: number
  lowStockThreshold: number
  isActive: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface PrescriptionMedItem {
  inventoryItemId?: string | PharmacyInventoryItem
  name?: string
  dosage?: string
  frequency?: string
  duration?: string
}

export interface Prescription {
  _id: string
  patientId: Patient | string
  doctorId: Doctor | string
  hospitalId: Hospital | string
  medications: PrescriptionMedItem[]
  status: 'pending_pickup' | 'dispensed' | 'cancelled'
  dispensedBy?: { _id: string; fullName: string; email: string } | string
  dispensedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

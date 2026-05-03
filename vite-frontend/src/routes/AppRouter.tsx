import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import DoctorSignupPage from '@/pages/auth/DoctorSignupPage'
import PatientSignupPage from '@/pages/auth/PatientSignupPage'
import HealthPassport from '@/pages/patient/HealthPassport'
import DoctorDashboard from '@/pages/doctor/DoctorDashboard'
import ReceptionistDashboard from '@/pages/receptionist/ReceptionistDashboard'
import StaffManagement from '@/pages/admin_hospital/StaffManagement'
import FacilityManagement from '@/pages/admin/FacilityManagement'
import ProfilePage from '@/pages/profile/ProfilePage'
import VerifyAccountPage from '@/pages/auth/VerifyAccountPage'
import PharmacistDashboard from '@/pages/pharmacist/PharmacistDashboard'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup/doctor" element={<DoctorSignupPage />} />
        <Route path="/signup/patient" element={<PatientSignupPage />} />
        <Route path="/verify-account" element={<VerifyAccountPage />} />

        <Route
          path="/patient/health-passport"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <DashboardLayout>
                <HealthPassport />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DashboardLayout>
                <DoctorDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/receptionist/dashboard"
          element={
            <ProtectedRoute allowedRoles={['receptionist']}>
              <DashboardLayout>
                <ReceptionistDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin-hospital/staff"
          element={
            <ProtectedRoute allowedRoles={['admin_hospital']}>
              <DashboardLayout>
                <StaffManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/facilities"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout>
                <FacilityManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['patient', 'doctor', 'receptionist', 'admin_hospital', 'admin', 'pharmacist']}>
              <DashboardLayout>
                <ProfilePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pharmacist/dashboard"
          element={
            <ProtectedRoute allowedRoles={['pharmacist']}>
              <DashboardLayout>
                <PharmacistDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

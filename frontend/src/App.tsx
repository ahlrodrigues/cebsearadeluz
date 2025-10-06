import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import { PrivateRoute } from './auth/RouteGuards'
import CreateUserPage from './pages/users/CreateUserPage'
import EditUserPage from './pages/users/EditUserPage'
import UserListPage from './pages/users/UserListPage'
import UserPassesPage from './pages/users/UserPassesPage'
import UserExamPage from './pages/users/UserExamPage'
import ScanPassPage from './pages/ScanPassPage'
import UserQrPage from './pages/users/UserQrPage'
import KioskPage from './pages/KioskPage'
import ScanLogsPage from './pages/reports/ScanLogsPage'

const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/users" element={<UserListPage />} />
        <Route path="/users/new" element={<CreateUserPage />} />
        <Route path="/users/:userId/edit" element={<EditUserPage />} />
        <Route path="/users/:userId/passes" element={<UserPassesPage />} />
        <Route path="/users/:userId/exam" element={<UserExamPage />} />
        <Route path="/users/:userId/qr" element={<UserQrPage />} />
        <Route path="/scan" element={<ScanPassPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/reports/scans" element={<ScanLogsPage />} />
        <Route path="*" element={<Navigate to="/users" replace />} />
      </Route>
    </Routes>
  )
}

export default App

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import CreateUserPage from './pages/users/CreateUserPage'
import EditUserPage from './pages/users/EditUserPage'
import UserListPage from './pages/users/UserListPage'
import UserPassesPage from './pages/users/UserPassesPage'
import UserExamPage from './pages/users/UserExamPage'
import ScanPassPage from './pages/ScanPassPage'
import UserQrPage from './pages/users/UserQrPage'
import KioskPage from './pages/KioskPage'
import ScanLogsPage from './pages/reports/ScanLogsPage'
// import DailyStatusPage from './pages/reports/DailyStatusPage'
import SignupPage from './pages/assistido/SignupPage'
import MyQrPage from './pages/assistido/MyQrPage'
import MyPassesPage from './pages/assistido/MyPassesPage'
import EditMyProfile from './pages/assistido/EditMyProfile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ConfirmAccount from './pages/ConfirmAccount'
import ForbiddenPage from './pages/ForbiddenPage'
import InterviewDashboard from './pages/InterviewDashboard'
import ExamsPage from './pages/ExamsPage'
import ExamsTodayPage from './pages/ExamsTodayPage'
import { PrivateRoute, RoleRoute } from './auth/RouteGuards'
import InstallPage from './pages/InstallPage'

const HomeRedirect = () => {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={session.role === 'user' ? '/app/assistido/qr' : '/users'} replace />
}

const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/reports" element={<Navigate to="/reports/scans" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/confirm" element={<ConfirmAccount />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/install" element={<InstallPage />} />
        {/** Rota "/tickets" removida: emissão de senhas via página de Presenças */}
        <Route
          path="/users"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin","recepcao","entrevista"]}>
                <UserListPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin"]}>
                <CreateUserPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/users/:userId/edit"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin"]}>
                <EditUserPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/users/:userId/passes"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin","recepcao","entrevista"]}>
                <UserPassesPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/users/:userId/exam"
          element={
            <PrivateRoute>
              <RoleRoute roles={["exame","admin"]}>
                <UserExamPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/users/:userId/qr"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin"]}>
                <UserQrPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <PrivateRoute>
              <RoleRoute roles={["recepcao","admin"]}>
                <ScanPassPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/kiosk"
          element={
            <PrivateRoute>
              <RoleRoute roles={["recepcao","admin"]}>
                <KioskPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/scans"
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin","recepcao","entrevista"]}>
                <ScanLogsPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        {/** Rota removida: /reports/daily-status */}
        <Route
          path="/app/assistido/qr"
          element={
            <PrivateRoute>
              <RoleRoute roles={["user"]}>
                <MyQrPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/app/assistido/passes"
          element={
            <PrivateRoute>
              <RoleRoute roles={["user"]}>
                <MyPassesPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/app/assistido/profile"
          element={
            <PrivateRoute>
              <RoleRoute roles={["user"]}>
                <EditMyProfile />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/exams"
          element={
            <PrivateRoute>
              <RoleRoute roles={["exame"]}>
                <ExamsPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/exams/today"
          element={
            <PrivateRoute>
              <RoleRoute roles={["exame"]}>
                <ExamsTodayPage />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/interviews"
          element={
            <PrivateRoute>
              <RoleRoute roles={["entrevista","admin"]}>
                <InterviewDashboard />
              </RoleRoute>
            </PrivateRoute>
          }
        />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  )
}

export default App

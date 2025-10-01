import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout'
import CreateUserPage from './pages/users/CreateUserPage'
import EditUserPage from './pages/users/EditUserPage'
import UserListPage from './pages/users/UserListPage'
import UserPassesPage from './pages/users/UserPassesPage'
import UserExamPage from './pages/users/UserExamPage'

const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<UserListPage />} />
        <Route path="/users/new" element={<CreateUserPage />} />
        <Route path="/users/:userId/edit" element={<EditUserPage />} />
        <Route path="/users/:userId/passes" element={<UserPassesPage />} />
        <Route path="/users/:userId/exam" element={<UserExamPage />} />
        <Route path="*" element={<Navigate to="/users" replace />} />
      </Route>
    </Routes>
  )
}

export default App

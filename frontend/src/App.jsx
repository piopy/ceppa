import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ConfirmHost } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CourseView from './pages/CourseView';
import HandsOnLabs from './pages/HandsOnLabs';
import Roadmaps from './pages/Roadmaps';
import LabView from './pages/LabView';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<ProtectedRoute />}>
             <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/course/:courseId/*" element={<CourseView />} />
                <Route path="/labs" element={<HandsOnLabs />} />
                 <Route path="/roadmaps" element={<Roadmaps />} />
                <Route path="/labs/:courseId/*" element={<LabView />} />
             </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-center" />
        <ConfirmHost />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

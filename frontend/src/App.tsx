import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AIChat from './pages/AIChat';
import Appointments from './pages/Appointments';
import VideoConsultation from './pages/VideoConsultation';
import Profile from './pages/Profile';
import FamilyProfile from './pages/FamilyProfile';
import MultilingualSupport from './pages/MultilingualSupport';
import PredictiveHealthInsights from './pages/PredictiveHealthInsights';
import About from './pages/About';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import AuraMedLoader from './components/AuraMedLoader';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppWithAuth() {
  const { user, token } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const publicPaths = new Set(['/', '/login', '/register', '/about']);
  const hideChrome = publicPaths.has(location.pathname);

  // Show a brief branded loader during route transitions
  useEffect(() => {
    setRouteLoading(true);
    // Allow the next page to render; hide shortly after to cover fetch/layout
    const t = setTimeout(() => setRouteLoading(false), 800);
    return () => clearTimeout(t);
  }, [location.pathname]);
 
  // Initial splash before the first paint of Landing (or any route)
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 3000);
    return () => clearTimeout(t);
  }, []);
  
  return (
    <SocketProvider user={user} token={token}>
          <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-teal-900 transition-all duration-300">
            <AuraMedLoader active={initialLoading || routeLoading} />
            {!hideChrome && (
              <Navbar
                isSidebarOpen={!!user && isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              />
            )}

            {/* Sidebar (only when authenticated) */}
            {user && !hideChrome && (
              <Sidebar isOpen={isSidebarOpen} />
            )}

            <main
              className={`transition-all duration-300 ${user && !hideChrome ? (isSidebarOpen ? 'ml-64' : 'ml-16') : ''}`}
            >
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
                <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
                <Route path="/about" element={<About />} />
                
                {/* Protected Routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardRouter />
                  </ProtectedRoute>
                } />
                
                <Route path="/ai-chat" element={
                  <ProtectedRoute>
                    <AIChat />
                  </ProtectedRoute>
                } />
                
                <Route path="/appointments" element={
                  <ProtectedRoute>
                    <Appointments />
                  </ProtectedRoute>
                } />
                
                <Route path="/video/:roomId" element={
                  <ProtectedRoute>
                    <VideoConsultation />
                  </ProtectedRoute>
                } />
                
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                
                <Route path="/family" element={
                  <ProtectedRoute>
                    <FamilyProfile />
                  </ProtectedRoute>
                } />
                
                <Route path="/multilingual" element={
                  <ProtectedRoute>
                    <MultilingualSupport />
                  </ProtectedRoute>
                } />
                
                <Route path="/predictive-insights" element={
                  <ProtectedRoute>
                    <PredictiveHealthInsights />
                  </ProtectedRoute>
                } />
                
                <Route path="/video-consultation" element={
                  <ProtectedRoute>
                    <VideoConsultation />
                  </ProtectedRoute>
                } />
                
                <Route path="/video/:roomId" element={
                  <ProtectedRoute>
                    <VideoConsultation />
                  </ProtectedRoute>
                } />
              </Routes>
            </main>

            {/* Global Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
      </SocketProvider>
    );
}

// Dashboard Router Component
function DashboardRouter() {
  const { user } = useAuth();
  
  if (!user) {
    return <LoadingSpinner />;
  }
  
  switch (user.role) {
    case 'PATIENT':
      return <PatientDashboard />;
    case 'DOCTOR':
      return <DoctorDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default App;

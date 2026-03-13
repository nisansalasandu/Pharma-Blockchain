import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import NMRADashboard from './pages/NMRA/NMRADashboard';
import ManufacturerDashboard from './pages/Manufacturer/ManufacturerDashboard';
import SPCDashboard from './pages/SPC/SPCDashboard';
import MSDDashboard from './pages/MSD/MSDDashboard';
import PharmacyDashboard from './pages/Pharmacy/PharmacyDashboard';
import HospitalDashboard from './pages/Hospital/HospitalDashboard';
import PatientDashboard from './pages/Patient/PatientDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('pharmachain_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('pharmachain_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('pharmachain_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pharmachain_user');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading PharmaChain...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        {user && (
          <Navbar 
            userRole={user.role} 
            userName={user.name}
            onLogout={handleLogout}
          />
        )}
        
        <main className="main-content">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                user ? <Navigate to={getRoleDashboard(user.role)} /> : <Login onLogin={handleLogin} />
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/nmra" 
              element={
                user && user.role === 1 ? <NMRADashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/spc" 
              element={
                user && user.role === 2 ? <SPCDashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/msd" 
              element={
                user && user.role === 3 ? <MSDDashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/manufacturer" 
              element={
                user && user.role === 4 ? <ManufacturerDashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/pharmacy" 
              element={
                user && user.role === 7 ? <PharmacyDashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/hospital" 
              element={
                user && user.role === 8 ? <HospitalDashboard /> : <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/patient" 
              element={
                user && user.role === 10 ? <PatientDashboard /> : <Navigate to="/login" />
              } 
            />

            {/* Default Routes */}
            <Route 
              path="/" 
              element={
                user ? <Navigate to={getRoleDashboard(user.role)} /> : <Navigate to="/login" />
              } 
            />
            
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>

        <ToastContainer 
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

// Helper function to get dashboard route based on role
const getRoleDashboard = (role) => {
  const dashboards = {
    1: '/nmra',
    2: '/spc',
    3: '/msd',
    4: '/manufacturer',
    7: '/pharmacy',
    8: '/hospital',
    10: '/patient'
  };
  return dashboards[role] || '/login';
};

export default App;
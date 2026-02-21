import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import MentorDashboard from './components/MentorDashboard';
import StudentDashboard from './components/StudentDashboard';
import ParentDashboard from './components/ParentDashboard';

function PrivateRoute({ children, allowedRole }) {
  const { currentUser, userRole } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRole && userRole !== allowedRole) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/mentor" 
            element={
              <PrivateRoute allowedRole="mentor">
                <MentorDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/student" 
            element={
              <PrivateRoute allowedRole="student">
                <StudentDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/parent" 
            element={
              <PrivateRoute allowedRole="parent">
                <ParentDashboard />
              </PrivateRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

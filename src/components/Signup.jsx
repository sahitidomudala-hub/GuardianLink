import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setError('');
    setLoading(true);

    try {
      // For students and parents, verify they exist in the system
      if (formData.role === 'student') {
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('email', '==', formData.email));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError('Student email not found. Please contact your mentor to add you first.');
          setLoading(false);
          return;
        }
      }
      
      if (formData.role === 'parent') {
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('parentEmail', '==', formData.email));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError('Parent email not found. Please contact your child\'s mentor to add you first.');
          setLoading(false);
          return;
        }
      }

      await signup(formData.email, formData.password, formData.role, {
        name: formData.name
      });
      navigate(`/${formData.role}`);
    } catch (err) {
      setError('Failed to create account: ' + err.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '50px' }}>
      <div className="card">
        <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>GuardianLink</h1>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>Create your account</p>
        
        {error && <div className="alert alert-danger">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})} 
              required 
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              {formData.role === 'student' && 'Use the email your mentor registered for you'}
              {formData.role === 'parent' && 'Use the parent email your child\'s mentor registered'}
              {formData.role === 'mentor' && 'Any email address'}
            </small>
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Confirm Password</label>
            <input 
              type="password" 
              value={formData.confirmPassword} 
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>I am a</label>
            <select 
              value={formData.role} 
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="mentor">Mentor</option>
            </select>
          </div>
          
          {formData.role !== 'mentor' && (
            <div className="alert alert-warning" style={{ fontSize: '13px', padding: '10px' }}>
              <strong>Note:</strong> Your mentor must add you to the system first before you can sign up.
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;

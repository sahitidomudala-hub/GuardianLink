import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { seedDemoData } from '../utils/demoSeeder';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('mentor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedLog, setSeedLog] = useState([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await login(email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userRole = userDoc.data().role;

        if (userRole !== role) {
          setError(`This account is registered as ${userRole}, not ${role}. Please select the correct role.`);
          setLoading(false);
          return;
        }

        navigate(`/${userRole}`);
      } else {
        setError('User data not found');
      }
    } catch (err) {
      setError('Failed to login: ' + err.message);
    }

    setLoading(false);
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedLog([]);
    setError('');

    await seedDemoData((msg) => {
      setSeedLog(prev => [...prev, msg]);
    });

    setSeeding(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>GuardianLink</h1>
        <p className="subtitle">Student Mentoring System</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="mentor">Mentor</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
            disabled={loading || seeding}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '12px', marginBottom: '10px' }}>
            First time? Load demo accounts to get started.
          </p>
          <button
            className="btn btn-success"
            style={{ width: '100%', fontSize: '12px' }}
            onClick={handleSeedDemo}
            disabled={seeding || loading}
          >
            {seeding ? 'Loading Demo Data...' : '🚀 Load Demo Data'}
          </button>
        </div>

        {seedLog.length > 0 && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            background: '#1e1e1e',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#4ec9b0'
          }}>
            {seedLog.map((line, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#888' }}>
          Student or Parent? <Link to="/signup">Sign up here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;

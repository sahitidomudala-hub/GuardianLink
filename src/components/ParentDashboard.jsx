import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { getStatusColor, getRiskStatus } from '../utils/riskLogic';

function ParentDashboard() {
  const { logout, currentUser } = useAuth();
  const [child, setChild] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchChildData();
    fetchNotifications();
  }, []);

  const fetchChildData = async () => {
    // Find student by parent email
    const q = query(collection(db, 'students'), where('parentEmail', '==', currentUser.email));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const childData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setChild(childData);
      
      // Filter notes that are parent-visible
      const visibleNotes = (childData.notes || []).filter(note => 
        !note.isConfidential && 
        note.isParentVisible && 
        (!note.isSensitive || note.approved === true)
      );
      setNotes(visibleNotes);
    }
  };

  const fetchNotifications = async () => {
    const q = query(
      collection(db, 'notifications'), 
      where('parentEmail', '==', currentUser.email),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setNotifications(notifs);
  };

  return (
    <div>
      <div className="navbar">
        <h2>Parent Dashboard</h2>
        <button className="btn btn-danger" onClick={logout}>Logout</button>
      </div>
      
      <div className="container">
        {child ? (
          <>
            <div className="card">
              <h3>{child.name}'s Performance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <div>
                  <h4>Attendance</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                    <span className={`status-indicator status-${getStatusColor(child.attendance, 'attendance')}`}></span>
                    {child.attendance}%
                  </div>
                  <p style={{ color: '#666', marginTop: '10px' }}>
                    {child.attendance >= 85 ? 'Excellent attendance' : 
                     child.attendance >= 80 ? 'Good, but can improve' : 
                     'Critical - needs immediate attention'}
                  </p>
                </div>
                <div>
                  <h4>GPA (Marks)</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                    <span className={`status-indicator status-${getStatusColor(child.marks, 'marks')}`}></span>
                    {child.marks}%
                  </div>
                  <p style={{ color: '#666', marginTop: '10px' }}>
                    {child.marks >= 75 ? 'Great academic performance' : 
                     child.marks >= 60 ? 'Needs improvement' : 
                     'Critical - intervention required'}
                  </p>
                </div>
              </div>
              
              {getRiskStatus(child.attendance, child.marks) && (
                <div className="alert alert-danger" style={{ marginTop: '20px' }}>
                  <strong>⚠️ URGENT: Student At Risk</strong>
                  <p style={{ marginTop: '10px', marginBottom: '0' }}>
                    Your child needs immediate attention. Both attendance ({child.attendance}%) and marks ({child.marks}%) 
                    are critically low. Please schedule a meeting with the mentor as soon as possible.
                  </p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="card">
                <h3>Risk Notifications</h3>
                {notifications.map(notif => (
                  <div key={notif.id} className="alert alert-danger" style={{ marginBottom: '10px' }}>
                    <p style={{ marginBottom: '5px' }}><strong>{notif.type === 'risk_alert' ? '⚠️ Risk Alert' : 'Notification'}</strong></p>
                    <p style={{ marginBottom: '0' }}>{notif.message}</p>
                    <small style={{ color: '#666' }}>
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : 'Just now'}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <h3>Session Notes</h3>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Notes from mentors about your child's progress and behavior
              </p>
              {notes.length === 0 ? (
                <p style={{ color: '#999', fontStyle: 'italic' }}>No notes available yet</p>
              ) : (
                notes.map((note, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '15px', 
                      background: '#f8f9fa', 
                      borderRadius: '4px', 
                      marginBottom: '10px',
                      borderLeft: '4px solid #007bff'
                    }}
                  >
                    <p style={{ marginBottom: '10px' }}>{note.content}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#666' }}>
                        {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'Recent'}
                      </small>
                      {note.isSensitive && note.approved && (
                        <span style={{ fontSize: '12px', color: '#28a745' }}>✓ Approved by student</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {child.tasks && child.tasks.length > 0 && (
              <div className="card">
                <h3>Assigned Tasks</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  Tasks assigned to your child by mentors
                </p>
                {child.tasks.map((task, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '15px', 
                      background: task.completed ? '#d4edda' : '#fff3cd', 
                      borderRadius: '4px', 
                      marginBottom: '10px',
                      borderLeft: task.completed ? '4px solid #28a745' : '4px solid #ffc107'
                    }}
                  >
                    <h4 style={{ marginBottom: '5px' }}>{task.title}</h4>
                    <p style={{ color: '#666', marginBottom: '5px' }}>{task.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#999' }}>Due: {task.dueDate}</small>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        color: task.completed ? '#28a745' : '#856404'
                      }}>
                        {task.completed ? '✓ Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <p style={{ textAlign: 'center', color: '#999' }}>
              No child data found. Please contact your mentor to link your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentDashboard;

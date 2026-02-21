import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { getStatusColor } from '../utils/riskLogic';

function StudentDashboard() {
  const { logout, currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchNotifications();
  }, []);

  const fetchProfile = async () => {
    const q = query(collection(db, 'students'), where('email', '==', currentUser.email));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setProfile(studentData);
      setTasks(studentData.tasks || []);
      setMeetings(studentData.meetings || []);
    }
  };

  const fetchNotifications = async () => {
    const q = query(
      collection(db, 'notifications'), 
      where('studentEmail', '==', currentUser.email),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setNotifications(notifs);
  };

  const handleNoteApproval = async (notificationId, noteContent, approved) => {
    // Update student's notes
    const studentRef = doc(db, 'students', profile.id);
    const studentDoc = await getDoc(studentRef);
    const notes = studentDoc.data().notes || [];
    
    const updatedNotes = notes.map(note => {
      if (note.content === noteContent && note.isSensitive) {
        return { ...note, approved };
      }
      return note;
    });

    await updateDoc(studentRef, { notes: updatedNotes });

    // Mark notification as read
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });

    // Notify mentor if rejected
    if (!approved) {
      await addDoc(collection(db, 'notifications'), {
        type: 'note_rejected',
        message: `Student ${profile.name} rejected parent visibility for a sensitive note.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    fetchNotifications();
    fetchProfile();
  };

  const handleMeetingReschedule = async (meetingIndex) => {
    const meeting = meetings[meetingIndex];
    
    if (meeting.rescheduleCount >= 2) {
      alert('Maximum reschedule limit reached (2 times)');
      return;
    }

    const newDate = prompt('Enter new meeting date (YYYY-MM-DD):');
    if (!newDate) return;

    const updatedMeetings = [...meetings];
    updatedMeetings[meetingIndex] = {
      ...meeting,
      date: newDate,
      rescheduleCount: (meeting.rescheduleCount || 0) + 1,
      status: 'rescheduled'
    };

    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { meetings: updatedMeetings });

    // Notify mentor
    await addDoc(collection(db, 'notifications'), {
      type: 'meeting_rescheduled',
      message: `${profile.name} rescheduled a meeting to ${newDate}`,
      createdAt: serverTimestamp(),
      read: false
    });

    setMeetings(updatedMeetings);
  };

  const handleAcceptMeeting = async (meetingIndex) => {
    const updatedMeetings = [...meetings];
    updatedMeetings[meetingIndex].status = 'accepted';

    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { meetings: updatedMeetings });

    setMeetings(updatedMeetings);
  };

  const markTaskComplete = async (taskIndex) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].completed = true;

    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { tasks: updatedTasks });

    setTasks(updatedTasks);
  };

  return (
    <div>
      <div className="navbar">
        <h2>Student Dashboard</h2>
        <button className="btn btn-danger" onClick={logout}>Logout</button>
      </div>
      
      <div className="container">
        {profile && (
          <div className="card">
            <h3>My Performance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <h4>Attendance</h4>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  <span className={`status-indicator status-${getStatusColor(profile.attendance, 'attendance')}`}></span>
                  {profile.attendance}%
                </div>
                <p style={{ color: '#666', marginTop: '10px' }}>
                  {profile.attendance >= 85 ? 'Excellent!' : profile.attendance >= 80 ? 'Good, but can improve' : 'Needs improvement'}
                </p>
              </div>
              <div>
                <h4>Marks (GPA)</h4>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  <span className={`status-indicator status-${getStatusColor(profile.marks, 'marks')}`}></span>
                  {profile.marks}%
                </div>
                <p style={{ color: '#666', marginTop: '10px' }}>
                  {profile.marks >= 75 ? 'Great work!' : profile.marks >= 60 ? 'Keep pushing' : 'Need more effort'}
                </p>
              </div>
            </div>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="card">
            <h3>Notifications</h3>
            {notifications.map(notif => (
              <div key={notif.id} className="alert alert-warning" style={{ marginBottom: '10px' }}>
                <p>{notif.message}</p>
                {notif.type === 'note_approval' && (
                  <div style={{ marginTop: '10px' }}>
                    <button 
                      className="btn btn-success" 
                      style={{ marginRight: '10px' }} 
                      onClick={() => handleNoteApproval(notif.id, notif.noteContent, true)}
                    >
                      Approve Parent Visibility
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleNoteApproval(notif.id, notif.noteContent, false)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tasks.length > 0 && (
          <div className="card">
            <h3>My Tasks</h3>
            {tasks.map((task, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '15px', 
                  background: task.completed ? '#d4edda' : '#f8f9fa', 
                  borderRadius: '4px', 
                  marginBottom: '10px',
                  borderLeft: task.completed ? '4px solid #28a745' : '4px solid #007bff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h4 style={{ marginBottom: '5px' }}>{task.title}</h4>
                    <p style={{ color: '#666', marginBottom: '5px' }}>{task.description}</p>
                    <small style={{ color: '#999' }}>Due: {task.dueDate}</small>
                  </div>
                  {!task.completed && (
                    <button 
                      className="btn btn-success" 
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => markTaskComplete(index)}
                    >
                      Mark Complete
                    </button>
                  )}
                  {task.completed && (
                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {meetings.length > 0 && (
          <div className="card">
            <h3>Meetings</h3>
            {meetings.map((meeting, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '15px', 
                  background: '#f8f9fa', 
                  borderRadius: '4px', 
                  marginBottom: '10px' 
                }}
              >
                <p><strong>Date:</strong> {meeting.date}</p>
                <p><strong>Status:</strong> {meeting.status || 'pending'}</p>
                <p><strong>Reschedules:</strong> {meeting.rescheduleCount || 0}/2</p>
                {meeting.status !== 'accepted' && (
                  <div style={{ marginTop: '10px' }}>
                    <button 
                      className="btn btn-success" 
                      style={{ marginRight: '10px' }}
                      onClick={() => handleAcceptMeeting(index)}
                    >
                      Accept
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleMeetingReschedule(index)}
                      disabled={meeting.rescheduleCount >= 2}
                    >
                      Reschedule ({meeting.rescheduleCount || 0}/2)
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;

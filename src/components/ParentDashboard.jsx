import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getStatusColor, getRiskStatus } from '../utils/riskLogic';
import { requestNotificationPermission, checkAndNotify } from '../utils/webNotifications';
import PerformanceChart from './PerformanceChart';
import VideoCall from './VideoCall';

function ParentDashboard() {
  const { logout, currentUser } = useAuth();
  const [child, setChild] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showMeetingRequest, setShowMeetingRequest] = useState(false);
  const [meetingReqForm, setMeetingReqForm] = useState({ date: '', time: '', reason: '' });
  const [activeCall, setActiveCall] = useState(null);

  const prevNotifCount = React.useRef(0);

  useEffect(() => {
    requestNotificationPermission();
    fetchChildData();
    fetchNotifications();
  }, []);

  const fetchChildData = async () => {
    const q = query(collection(db, 'students'), where('parentEmail', '==', currentUser.email));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const childData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setChild(childData);

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
    prevNotifCount.current = checkAndNotify(notifs, prevNotifCount.current);
  };

  const handleMeetingRequest = async (e) => {
    e.preventDefault();
    if (!child) return;

    await addDoc(collection(db, 'meetingRequests'), {
      studentId: child.id,
      studentName: child.name,
      studentEmail: child.email,
      parentEmail: currentUser.email,
      mentorId: child.mentorId || '',
      date: meetingReqForm.date,
      time: meetingReqForm.time,
      reason: meetingReqForm.reason,
      requestedBy: 'parent',
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await addDoc(collection(db, 'notifications'), {
      type: 'meeting_request',
      message: `${child.name}'s parent has requested a meeting on ${meetingReqForm.date} at ${meetingReqForm.time}: ${meetingReqForm.reason}`,
      createdAt: serverTimestamp(),
      read: false
    });

    setMeetingReqForm({ date: '', time: '', reason: '' });
    setShowMeetingRequest(false);
    alert('Meeting request sent to the mentor!');
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
            {/* Performance Chart */}
            <div className="card">
              <h3>{child.name}'s Performance</h3>
              <PerformanceChart
                attendance={child.attendance}
                marks={child.marks}
                history={child.history}
              />
            </div>

            {/* Risk Alert + Intervention Status */}
            {getRiskStatus(child.attendance, child.marks) && (
              <div className="alert alert-danger">
                <strong>⚠️ URGENT: Student At Risk</strong>
                <p style={{ marginTop: '10px', marginBottom: '10px' }}>
                  Your child needs immediate attention. Both attendance ({child.attendance}%) and marks ({child.marks}%)
                  are critically low. Please schedule a meeting with the mentor as soon as possible.
                </p>
                <div className="flex-responsive" style={{ gap: '15px', alignItems: 'center' }}>
                  <div>
                    <span style={{ display: 'inline-block', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: getStatusColor(child.attendance, 'attendance') === 'red' ? '#f8d7da' : getStatusColor(child.attendance, 'attendance') === 'yellow' ? '#fff3cd' : '#d4edda', color: getStatusColor(child.attendance, 'attendance') === 'red' ? '#721c24' : getStatusColor(child.attendance, 'attendance') === 'yellow' ? '#856404' : '#155724' }}>
                      Attendance: {child.attendance}%
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: getStatusColor(child.marks, 'marks') === 'red' ? '#f8d7da' : getStatusColor(child.marks, 'marks') === 'yellow' ? '#fff3cd' : '#d4edda', color: getStatusColor(child.marks, 'marks') === 'red' ? '#721c24' : getStatusColor(child.marks, 'marks') === 'yellow' ? '#856404' : '#155724' }}>
                      Marks: {child.marks}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Intervention Banner */}
            {child.intervention?.initiated && (
              <div style={{ padding: '15px', borderRadius: '8px', background: '#fff3cd', border: '2px solid #ffc107', marginBottom: '20px' }}>
                <h4 style={{ color: '#856404', marginBottom: '8px' }}>🔄 Intervention in Progress</h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>Initiated on: {new Date(child.intervention.date).toLocaleDateString()}</p>
                <p style={{ fontSize: '13px', color: '#555' }}><strong>Details:</strong> {child.intervention.note}</p>
              </div>
            )}

            {/* Mentor Feedback Snippet */}
            {child.mentorFeedback && (
              <div className="card">
                <h3>Mentor Feedback</h3>
                <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px', borderLeft: '4px solid #28a745' }}>
                  <p style={{ fontStyle: 'italic', marginBottom: 0 }}>"{child.mentorFeedback}"</p>
                </div>
              </div>
            )}

            {/* Request Meeting */}
            <div className="card">
              <div className="flex-responsive" style={{ justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, border: 'none' }}>Schedule a Meeting with Mentor</h3>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => setShowMeetingRequest(!showMeetingRequest)}
                >
                  {showMeetingRequest ? 'Cancel' : '📩 Request Meeting'}
                </button>
              </div>
              <p style={{ color: '#666', fontSize: '13px' }}>
                Want to discuss your child's progress? Send a meeting request to the mentor.
              </p>

              {showMeetingRequest && (
                <form onSubmit={handleMeetingRequest} style={{ padding: '15px', background: '#f0f7ff', borderRadius: '8px', marginTop: '10px' }}>
                  <div className="grid-cols-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className="form-group">
                      <label>Preferred Date</label>
                      <input
                        type="date"
                        value={meetingReqForm.date}
                        onChange={(e) => setMeetingReqForm({ ...meetingReqForm, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Preferred Time</label>
                      <input
                        type="time"
                        value={meetingReqForm.time}
                        onChange={(e) => setMeetingReqForm({ ...meetingReqForm, time: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Reason for Meeting</label>
                    <textarea
                      placeholder="e.g., I'd like to discuss my child's academic improvement plan"
                      value={meetingReqForm.reason}
                      onChange={(e) => setMeetingReqForm({ ...meetingReqForm, reason: e.target.value })}
                      rows="2"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-success">Send Request</button>
                </form>
              )}
            </div>

            {/* Parent's Meetings */}
            {child.meetings && child.meetings.filter(m => m.invitees && m.invitees.includes('parent')).length > 0 && (
              <div className="card">
                <h3>Your Meetings</h3>
                {child.meetings
                  .filter(m => m.invitees && m.invitees.includes('parent'))
                  .map((meeting, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '15px',
                        background: meeting.status === 'accepted' ? '#d4edda' : '#f8f9fa',
                        borderRadius: '4px',
                        marginBottom: '10px',
                        borderLeft: `4px solid ${meeting.status === 'accepted' ? '#28a745' : '#007bff'}`
                      }}
                    >
                      <p><strong>Date:</strong> {meeting.date} {meeting.time ? `at ${meeting.time}` : ''}</p>
                      {meeting.agenda && <p><strong>Agenda:</strong> {meeting.agenda}</p>}
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <small style={{ color: '#666' }}>
                          <strong>Status:</strong> {meeting.status || 'pending'}
                        </small>
                        {meeting.invitees && (
                          <small style={{ color: '#555' }}>
                            <strong>With:</strong> {meeting.invitees.join(' & ')}
                          </small>
                        )}
                        {meeting.status === 'accepted' && (
                          <button
                            className="btn btn-success"
                            style={{ fontSize: '11px', padding: '4px 12px' }}
                            onClick={() => setActiveCall({
                              meetingId: meeting.meetingId || `meeting_${child.id}_${meeting.date}`,
                              userId: currentUser.uid,
                              userName: `${child.name}'s Parent`
                            })}
                          >
                            📹 Join Call
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="card">
                <h3>Notifications ({notifications.length})</h3>
                {notifications.map(notif => {
                  const typeConfig = {
                    risk_alert: { icon: '⚠️', label: 'Risk Alert', bg: '#f8d7da', border: '#dc3545' },
                    intervention_triggered: { icon: '🚨', label: 'Intervention', bg: '#fff3cd', border: '#ffc107' },
                    meeting_scheduled: { icon: '📅', label: 'Meeting Scheduled', bg: '#cce5ff', border: '#007bff' },
                    meeting_rescheduled: { icon: '📅', label: 'Meeting Update', bg: '#cce5ff', border: '#007bff' },
                    task_assigned: { icon: '📋', label: 'New Task', bg: '#d4edda', border: '#28a745' },
                  };
                  const config = typeConfig[notif.type] || { icon: '🔔', label: 'Notification', bg: '#e2e3e5', border: '#6c757d' };
                  return (
                    <div key={notif.id} style={{ padding: '12px', marginBottom: '10px', background: config.bg, borderRadius: '8px', borderLeft: `4px solid ${config.border}` }}>
                      <p style={{ marginBottom: '5px', fontWeight: 'bold' }}>{config.icon} {config.label}</p>
                      <p style={{ marginBottom: '5px', fontSize: '14px' }}>{notif.message}</p>
                      <small style={{ color: '#666' }}>
                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : 'Just now'}
                      </small>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Session Notes */}
            <div className="card">
              <h3>Session Notes</h3>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Notes from mentors about your child's progress
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

            {/* Child Tasks */}
            {child.tasks && child.tasks.length > 0 && (
              <div className="card">
                <h3>Assigned Tasks</h3>
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

      {/* Video Call Modal */}
      {activeCall && (
        <VideoCall
          meetingId={activeCall.meetingId}
          userId={activeCall.userId}
          userName={activeCall.userName}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}

export default ParentDashboard;

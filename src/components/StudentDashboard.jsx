import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getStatusColor } from '../utils/riskLogic';
import MeetingCalendar from './MeetingCalendar';
import PerformanceChart from './PerformanceChart';
import VideoCall from './VideoCall';
import { requestNotificationPermission, checkAndNotify } from '../utils/webNotifications';

function StudentDashboard() {
  const { logout, currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [personalGoals, setPersonalGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', targetDate: '' });
  const [editingGoalIndex, setEditingGoalIndex] = useState(null);

  // Meeting request form
  const [showMeetingRequest, setShowMeetingRequest] = useState(false);
  const [meetingReqForm, setMeetingReqForm] = useState({ date: '', time: '', reason: '' });

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');
  const [activeCall, setActiveCall] = useState(null);

  const prevNotifCount = React.useRef(0);

  useEffect(() => {
    requestNotificationPermission();
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    await fetchProfile();
    await fetchNotifications();
    setLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const q = query(collection(db, 'students'), where('email', '==', currentUser.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setProfile(data);
        setTasks(data.tasks || []);
        setMeetings(data.meetings || []);
        setPersonalGoals(data.personalGoals || []);
      }
    } catch (err) {
      console.error('fetchProfile error:', err);
      setError(`Failed to load profile: ${err.message}`);
    }
  };

  const fetchNotifications = async () => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('studentEmail', '==', currentUser.email),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifs);
      prevNotifCount.current = checkAndNotify(notifs, prevNotifCount.current);
    } catch (err) {
      console.error('fetchNotifications error:', err);
    }
  };

  // ── Note Approval ──
  const handleNoteApproval = async (notificationId, noteContent, approved) => {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });

    if (approved && profile) {
      const updatedNotes = (profile.notes || []).map(note => {
        if (note.content === noteContent && note.isSensitive) {
          return { ...note, approved: true };
        }
        return note;
      });
      const studentRef = doc(db, 'students', profile.id);
      await updateDoc(studentRef, { notes: updatedNotes });

      await addDoc(collection(db, 'notifications'), {
        type: 'note_approved',
        message: `${profile.name} approved a sensitive note for parent visibility`,
        createdAt: serverTimestamp(),
        read: false
      });
    } else if (!approved && profile) {
      // Reject the note and mark as not approved
      const updatedNotes = (profile.notes || []).map(note => {
        if (note.content === noteContent && note.isSensitive) {
          return { ...note, approved: false, isParentVisible: false };
        }
        return note;
      });
      const studentRef = doc(db, 'students', profile.id);
      await updateDoc(studentRef, { notes: updatedNotes });

      // Notify mentor that student rejected the note
      await addDoc(collection(db, 'notifications'), {
        type: 'note_rejected',
        studentEmail: profile.email,
        message: `${profile.name} rejected parent visibility for a sensitive note: "${noteContent.substring(0, 50)}..."`,
        createdAt: serverTimestamp(),
        read: false
      });
    }
    fetchNotifications();
    fetchProfile();
  };

  // ── Meeting Reschedule ──
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

    // Notify parent too
    if (profile.parentEmail) {
      await addDoc(collection(db, 'notifications'), {
        type: 'meeting_rescheduled',
        parentEmail: profile.parentEmail,
        studentEmail: profile.email,
        message: `Meeting for ${profile.name} has been rescheduled to ${newDate}`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    setMeetings(updatedMeetings);
  };

  const handleAcceptMeeting = async (meetingIndex) => {
    const updatedMeetings = [...meetings];
    updatedMeetings[meetingIndex].status = 'accepted';
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { meetings: updatedMeetings });
    setMeetings(updatedMeetings);
  };

  // ── Tasks ──
  const markTaskComplete = async (taskIndex) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].completed = true;
    updatedTasks[taskIndex].completedAt = new Date().toISOString();
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { tasks: updatedTasks });
    setTasks(updatedTasks);
  };

  // ── Personal Goals CRUD ──
  const handleAddGoal = async (e) => {
    e.preventDefault();
    const newGoal = {
      title: goalForm.title,
      description: goalForm.description,
      targetDate: goalForm.targetDate,
      completed: false,
      progress: 0,
      createdAt: new Date().toISOString()
    };

    const updatedGoals = [...personalGoals, newGoal];
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { personalGoals: updatedGoals });
    setPersonalGoals(updatedGoals);
    setGoalForm({ title: '', description: '', targetDate: '' });
    setShowGoalForm(false);
  };

  const handleUpdateGoalProgress = async (index, newProgress) => {
    const updatedGoals = [...personalGoals];
    updatedGoals[index].progress = parseInt(newProgress);
    if (parseInt(newProgress) >= 100) {
      updatedGoals[index].completed = true;
      updatedGoals[index].completedAt = new Date().toISOString();
    }
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { personalGoals: updatedGoals });
    setPersonalGoals(updatedGoals);
  };

  const handleDeleteGoal = async (index) => {
    if (!window.confirm('Delete this goal?')) return;
    const updatedGoals = personalGoals.filter((_, i) => i !== index);
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { personalGoals: updatedGoals });
    setPersonalGoals(updatedGoals);
  };

  const handleEditGoal = (index) => {
    const goal = personalGoals[index];
    setGoalForm({ title: goal.title, description: goal.description, targetDate: goal.targetDate });
    setEditingGoalIndex(index);
    setShowGoalForm(true);
  };

  const handleSaveEditGoal = async (e) => {
    e.preventDefault();
    const updatedGoals = [...personalGoals];
    updatedGoals[editingGoalIndex] = {
      ...updatedGoals[editingGoalIndex],
      title: goalForm.title,
      description: goalForm.description,
      targetDate: goalForm.targetDate
    };
    const studentRef = doc(db, 'students', profile.id);
    await updateDoc(studentRef, { personalGoals: updatedGoals });
    setPersonalGoals(updatedGoals);
    setGoalForm({ title: '', description: '', targetDate: '' });
    setEditingGoalIndex(null);
    setShowGoalForm(false);
  };

  // ── Meeting Request ──
  const handleMeetingRequest = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'meetingRequests'), {
      studentId: profile.id,
      studentName: profile.name,
      studentEmail: profile.email,
      parentEmail: profile.parentEmail || '',
      mentorId: profile.mentorId || '',
      date: meetingReqForm.date,
      time: meetingReqForm.time,
      reason: meetingReqForm.reason,
      requestedBy: 'student',
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // Notify mentor
    await addDoc(collection(db, 'notifications'), {
      type: 'meeting_request',
      message: `${profile.name} has requested a meeting on ${meetingReqForm.date} at ${meetingReqForm.time}: ${meetingReqForm.reason}`,
      createdAt: serverTimestamp(),
      read: false
    });

    setMeetingReqForm({ date: '', time: '', reason: '' });
    setShowMeetingRequest(false);
    alert('Meeting request sent to your mentor!');
  };

  // ── Tab styles ──
  const tabStyle = (tab) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '3px solid #C8102E' : '3px solid transparent',
    color: activeTab === tab ? '#C8102E' : '#666',
    fontWeight: activeTab === tab ? '600' : 'normal',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.3px'
  });

  const completedTasks = tasks.filter(t => t.completed).length;
  const completedGoals = personalGoals.filter(g => g.completed).length;

  return (
    <div>
      <div className="navbar">
        <h2>Student Dashboard</h2>
        <button className="btn btn-danger" onClick={logout}>Logout</button>
      </div>

      <div className="container">
        {loading && (
          <div className="card">
            <p style={{ textAlign: 'center', color: '#666' }}>Loading your data...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">{error}</div>
        )}

        {!loading && !profile && !error && (
          <div className="card">
            <p style={{ textAlign: 'center', color: '#999' }}>
              No student data found for your account. Please contact your mentor.
            </p>
          </div>
        )}

        {profile && (
          <>
            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', marginBottom: '20px', background: 'white', borderRadius: '8px 8px 0 0', padding: '0 10px' }}>
              <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>📊 Overview</button>
              <button style={tabStyle('goals')} onClick={() => setActiveTab('goals')}>🎯 Goals & Tasks</button>
              <button style={tabStyle('meetings')} onClick={() => setActiveTab('meetings')}>📅 Meetings</button>
              <button style={tabStyle('notifications')} onClick={() => setActiveTab('notifications')}>
                🔔 Notifications {notifications.length > 0 && <span style={{ background: '#dc3545', color: 'white', borderRadius: '50%', padding: '2px 7px', fontSize: '11px', marginLeft: '5px' }}>{notifications.length}</span>}
              </button>
            </div>

            {/* ──── OVERVIEW TAB ──── */}
            {activeTab === 'overview' && (
              <>
                <div className="card">
                  <h3>My Performance</h3>
                  <PerformanceChart
                    attendance={profile.attendance}
                    marks={profile.marks}
                    history={profile.history}
                  />
                </div>

                {/* Quick Stats Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="card" style={{ textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff' }}>{tasks.length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Mentor Tasks</div>
                    <div style={{ color: '#28a745', fontSize: '12px' }}>{completedTasks} completed</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#6f42c1' }}>{personalGoals.length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>My Goals</div>
                    <div style={{ color: '#28a745', fontSize: '12px' }}>{completedGoals} completed</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fd7e14' }}>{meetings.length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Meetings</div>
                    <div style={{ color: '#28a745', fontSize: '12px' }}>{meetings.filter(m => m.status === 'accepted').length} confirmed</div>
                  </div>
                </div>

                {/* Mentor Feedback */}
                {profile.mentorFeedback && (
                  <div className="card">
                    <h3>Mentor Feedback</h3>
                    <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px', borderLeft: '4px solid #28a745' }}>
                      <p style={{ fontStyle: 'italic', marginBottom: 0 }}>"{profile.mentorFeedback}"</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ──── GOALS & TASKS TAB ──── */}
            {activeTab === 'goals' && (
              <>
                {/* Mentor-Assigned Tasks */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Mentor-Assigned Tasks</h3>
                    {tasks.length > 0 && (
                      <span style={{ fontSize: '13px', color: '#666' }}>
                        {completedTasks}/{tasks.length} completed
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {tasks.length > 0 && (
                    <div style={{ width: '100%', background: '#e9ecef', borderRadius: '10px', height: '8px', marginBottom: '15px' }}>
                      <div style={{ width: `${(completedTasks / tasks.length) * 100}%`, background: '#28a745', borderRadius: '10px', height: '8px', transition: 'width 0.3s' }}></div>
                    </div>
                  )}

                  {tasks.length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No tasks assigned yet</p>
                  ) : (
                    tasks.map((task, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '15px',
                          background: task.completed ? '#d4edda' : new Date(task.dueDate) < new Date() ? '#fff5f5' : '#f8f9fa',
                          borderRadius: '4px',
                          marginBottom: '10px',
                          borderLeft: task.completed ? '4px solid #28a745' : new Date(task.dueDate) < new Date() ? '4px solid #dc3545' : '4px solid #007bff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <h4 style={{ marginBottom: '5px' }}>{task.title}</h4>
                            <p style={{ color: '#666', marginBottom: '5px' }}>{task.description}</p>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <small style={{ color: '#999' }}>Due: {task.dueDate}</small>
                              {task.completed ? (
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#d4edda', color: '#155724', fontWeight: 'bold' }}>✓ Completed</span>
                              ) : new Date(task.dueDate) < new Date() ? (
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f8d7da', color: '#721c24', fontWeight: 'bold' }}>⚠ Overdue</span>
                              ) : (
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#cce5ff', color: '#004085' }}>Pending</span>
                              )}
                            </div>
                          </div>
                          {!task.completed ? (
                            <button
                              className="btn btn-success"
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                              onClick={() => markTaskComplete(index)}
                            >
                              ✓ Complete
                            </button>
                          ) : (
                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Done</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Personal Goals */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>🎯 My Personal Goals</h3>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                      onClick={() => { setShowGoalForm(!showGoalForm); setEditingGoalIndex(null); setGoalForm({ title: '', description: '', targetDate: '' }); }}
                    >
                      {showGoalForm ? 'Cancel' : '+ Add Goal'}
                    </button>
                  </div>

                  {/* Progress bar */}
                  {personalGoals.length > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginTop: '10px' }}>
                        <span>{completedGoals}/{personalGoals.length} goals completed</span>
                        <span>{Math.round((completedGoals / personalGoals.length) * 100)}%</span>
                      </div>
                      <div style={{ width: '100%', background: '#e9ecef', borderRadius: '10px', height: '8px', marginBottom: '15px', marginTop: '5px' }}>
                        <div style={{ width: `${(completedGoals / personalGoals.length) * 100}%`, background: '#6f42c1', borderRadius: '10px', height: '8px', transition: 'width 0.3s' }}></div>
                      </div>
                    </>
                  )}

                  {/* Add/Edit Goal Form */}
                  {showGoalForm && (
                    <form onSubmit={editingGoalIndex !== null ? handleSaveEditGoal : handleAddGoal} style={{ padding: '15px', background: '#f0f0ff', borderRadius: '8px', marginBottom: '15px' }}>
                      <div className="form-group">
                        <label>Goal Title</label>
                        <input
                          type="text"
                          placeholder="e.g., Learn React Testing"
                          value={goalForm.title}
                          onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          placeholder="What do you want to achieve?"
                          value={goalForm.description}
                          onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                          rows="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Target Date</label>
                        <input
                          type="date"
                          value={goalForm.targetDate}
                          onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-success">
                        {editingGoalIndex !== null ? 'Save Changes' : 'Add Goal'}
                      </button>
                    </form>
                  )}

                  {personalGoals.length === 0 && !showGoalForm ? (
                    <p style={{ color: '#999', fontStyle: 'italic', marginTop: '10px' }}>
                      No personal goals yet. Click "Add Goal" to create your first one!
                    </p>
                  ) : (
                    personalGoals.map((goal, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '15px',
                          background: goal.completed ? '#d4edda' : '#f8f9fa',
                          borderRadius: '8px',
                          marginBottom: '10px',
                          borderLeft: goal.completed ? '4px solid #28a745' : '4px solid #6f42c1'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ marginBottom: '5px' }}>{goal.title}</h4>
                            {goal.description && <p style={{ color: '#666', marginBottom: '5px', fontSize: '14px' }}>{goal.description}</p>}
                            <small style={{ color: '#999' }}>Target: {goal.targetDate}</small>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {!goal.completed && (
                              <button className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleEditGoal(index)}>Edit</button>
                            )}
                            <button className="btn btn-danger" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleDeleteGoal(index)}>Delete</button>
                          </div>
                        </div>

                        {/* Progress Slider */}
                        {!goal.completed && (
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                              <span>Progress</span>
                              <span>{goal.progress || 0}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="10"
                              value={goal.progress || 0}
                              onChange={(e) => handleUpdateGoalProgress(index, e.target.value)}
                              style={{ width: '100%', marginTop: '5px' }}
                            />
                          </div>
                        )}
                        {goal.completed && (
                          <div style={{ marginTop: '8px', color: '#28a745', fontWeight: 'bold', fontSize: '13px' }}>✓ Goal Completed!</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ──── MEETINGS TAB ──── */}
            {activeTab === 'meetings' && (
              <>
                {/* Meeting Calendar */}
                <div className="card">
                  <h3>Meeting Calendar</h3>
                  <MeetingCalendar meetings={meetings.filter(m => !m.invitees || m.invitees.includes('student'))} />
                </div>

                {/* Request Meeting */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Request a Meeting</h3>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                      onClick={() => setShowMeetingRequest(!showMeetingRequest)}
                    >
                      {showMeetingRequest ? 'Cancel' : '📩 Request Meeting'}
                    </button>
                  </div>
                  <p style={{ color: '#666', fontSize: '13px' }}>
                    Want to meet your mentor? Send a request with your preferred date and time.
                  </p>

                  {showMeetingRequest && (
                    <form onSubmit={handleMeetingRequest} style={{ padding: '15px', background: '#f0f7ff', borderRadius: '8px', marginTop: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
                          placeholder="e.g., I'd like to discuss my academic improvement plan"
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

                {/* Upcoming Meetings List */}
                <div className="card">
                  <h3>Upcoming Meetings</h3>
                  {meetings.length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No meetings scheduled</p>
                  ) : (
                    meetings.filter(m => !m.invitees || m.invitees.includes('student')).map((meeting, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '15px',
                          background: '#f8f9fa',
                          borderRadius: '4px',
                          marginBottom: '10px',
                          borderLeft: `4px solid ${meeting.status === 'accepted' ? '#28a745' : meeting.status === 'rescheduled' ? '#ffc107' : '#007bff'}`
                        }}
                      >
                        <p><strong>Date:</strong> {meeting.date} {meeting.time ? `at ${meeting.time}` : ''}</p>
                        {meeting.agenda && <p><strong>Agenda:</strong> {meeting.agenda}</p>}
                        <p><strong>Status:</strong> <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          background: meeting.status === 'accepted' ? '#d4edda' : meeting.status === 'rescheduled' ? '#fff3cd' : '#cce5ff',
                          color: meeting.status === 'accepted' ? '#155724' : meeting.status === 'rescheduled' ? '#856404' : '#004085'
                        }}>{meeting.status || 'pending'}</span></p>
                        <p style={{ fontSize: '13px', color: '#666' }}>Reschedules: {meeting.rescheduleCount || 0}/2</p>
                        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {meeting.status !== 'accepted' && (
                            <>
                              <button className="btn btn-success" style={{ fontSize: '12px' }} onClick={() => handleAcceptMeeting(meetings.indexOf(meeting))}>
                                Accept
                              </button>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '12px' }}
                                onClick={() => handleMeetingReschedule(meetings.indexOf(meeting))}
                                disabled={meeting.rescheduleCount >= 2}
                              >
                                Reschedule ({meeting.rescheduleCount || 0}/2)
                              </button>
                            </>
                          )}
                          {meeting.status === 'accepted' && (
                            <button
                              className="btn btn-success"
                              style={{ fontSize: '12px', padding: '6px 14px' }}
                              onClick={() => setActiveCall({
                                meetingId: meeting.meetingId || `meeting_${profile.id}_${meeting.date}`,
                                userId: currentUser.uid,
                                userName: profile?.name || 'Student'
                              })}
                            >
                              📹 Join Call
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ──── NOTIFICATIONS TAB ──── */}
            {activeTab === 'notifications' && (
              <div className="card">
                <h3>Notifications ({notifications.length})</h3>
                {notifications.length === 0 ? (
                  <p style={{ color: '#999', fontStyle: 'italic' }}>No new notifications</p>
                ) : (
                  notifications.map(notif => {
                    const typeConfig = {
                      note_approval: { icon: '📝', label: 'Note Approval', bg: '#fff3cd', border: '#ffc107' },
                      task_assigned: { icon: '📋', label: 'New Task', bg: '#cce5ff', border: '#007bff' },
                      meeting_scheduled: { icon: '📅', label: 'Meeting', bg: '#d4edda', border: '#28a745' },
                      risk_alert: { icon: '⚠️', label: 'Risk Alert', bg: '#f8d7da', border: '#dc3545' },
                    };
                    const config = typeConfig[notif.type] || { icon: '🔔', label: 'Notification', bg: '#e2e3e5', border: '#6c757d' };
                    return (
                      <div key={notif.id} style={{ padding: '12px', marginBottom: '10px', background: config.bg, borderRadius: '8px', borderLeft: `4px solid ${config.border}` }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>{config.icon} {config.label}</p>
                        <p style={{ marginBottom: '5px', fontSize: '14px' }}>{notif.message}</p>
                        {notif.createdAt?.toDate && (
                          <small style={{ color: '#666' }}>{notif.createdAt.toDate().toLocaleString()}</small>
                        )}
                        {notif.type === 'note_approval' && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                            <button
                              className="btn btn-success"
                              style={{ fontSize: '12px', padding: '5px 12px' }}
                              onClick={() => handleNoteApproval(notif.id, notif.noteContent, true)}
                            >
                              ✓ Approve Parent Visibility
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '12px', padding: '5px 12px' }}
                              onClick={() => handleNoteApproval(notif.id, notif.noteContent, false)}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
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

export default StudentDashboard;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { getStatusColor, getRiskStatus, evaluateRiskChange } from '../utils/riskLogic';
import { generateStudentReport } from '../utils/pdfGenerator';
import CSVImport from './CSVImport';
import VideoCall from './VideoCall';
import AIAssistant from './AIAssistant';

const filterOptionStyle = {
  padding: '8px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  borderRadius: '4px',
  transition: 'background 0.2s'
};

const colorIndicator = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  display: 'inline-block'
};

function MentorDashboard() {
  const { logout, currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    attendance: '',
    marks: '',
    parentEmail: ''
  });
  const [noteForm, setNoteForm] = useState({
    content: '',
    isConfidential: false,
    isSensitive: false,
    isParentVisible: true
  });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', parentEmail: '', attendance: '', marks: '' });
  const [meetingForm, setMeetingForm] = useState({ date: '', agenda: '', invitees: 'student' });
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [feedbackText, setFeedbackText] = useState('');
  const [meetingRequests, setMeetingRequests] = useState([]);
  const [noteFilter, setNoteFilter] = useState('all');
  const [interventionNote, setInterventionNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    if (selectedStudent) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [selectedStudent]);

  const filteredStudents = students.filter(student => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'atRisk') return getRiskStatus(student.attendance, student.marks);
    if (statusFilter === 'lowAttendance') return student.attendance < 80;
    if (statusFilter === 'avgAttendance') return student.attendance >= 80 && student.attendance < 85;
    if (statusFilter === 'goodAttendance') return student.attendance >= 85;
    if (statusFilter === 'lowMarks') return student.marks < 60;
    if (statusFilter === 'avgMarks') return student.marks >= 60 && student.marks < 75;
    if (statusFilter === 'goodMarks') return student.marks >= 75;
    return true;
  }).sort((a, b) => {
    if (statusFilter.includes('Attendance')) {
      return (b.attendance || 0) - (a.attendance || 0);
    }
    if (statusFilter.includes('Marks')) {
      return (b.marks || 0) - (a.marks || 0);
    }
    if (statusFilter === 'atRisk') {
      // For at-risk, show the "less risky" (higher values) first as per "best to worst"
      const scoreA = (a.attendance || 0) + (a.marks || 0);
      const scoreB = (b.attendance || 0) + (b.marks || 0);
      return scoreB - scoreA;
    }
    // Default: Sort by name
    return (a.name || '').localeCompare(b.name || '');
  });

  useEffect(() => {
    fetchStudents();
    fetchMeetingRequests();

    // Auto-refresh every 15s to pick up meeting status changes
    const interval = setInterval(() => {
      fetchStudents();
      fetchMeetingRequests();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStudents = async () => {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('mentorId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    const studentsData = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(student => !student.deleted);
    setStudents(studentsData);

    // Refresh selectedStudent data if one is selected
    if (selectedStudent) {
      const updated = studentsData.find(s => s.id === selectedStudent.id);
      if (updated) setSelectedStudent(updated);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();

    const studentData = {
      name: formData.name,
      email: formData.email,
      attendance: parseFloat(formData.attendance),
      marks: parseFloat(formData.marks),
      parentEmail: formData.parentEmail,
      mentorId: currentUser.uid,
      notes: [],
      tasks: [],
      meetings: [],
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'students'), studentData);

    // Check if at risk and notify parent
    if (getRiskStatus(studentData.attendance, studentData.marks)) {
      await addDoc(collection(db, 'notifications'), {
        type: 'risk_alert',
        studentEmail: studentData.email,
        parentEmail: studentData.parentEmail,
        message: `${studentData.name} is at risk. Both attendance (${studentData.attendance}%) and marks (${studentData.marks}%) are critically low.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    setFormData({ name: '', email: '', attendance: '', marks: '', parentEmail: '' });
    setShowForm(false);
    fetchStudents();
  };

  const handleAddNote = async (e) => {
    e.preventDefault();

    const note = {
      content: noteForm.content,
      isConfidential: noteForm.isConfidential,
      isSensitive: noteForm.isSensitive,
      isParentVisible: noteForm.isParentVisible && !noteForm.isConfidential,
      approved: noteForm.isSensitive ? null : true,
      createdAt: new Date().toISOString(),
      mentorId: currentUser.uid
    };

    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, {
      notes: arrayUnion(note)
    });

    // Notify student if sensitive
    if (noteForm.isSensitive) {
      await addDoc(collection(db, 'notifications'), {
        type: 'note_approval',
        studentEmail: selectedStudent.email,
        studentId: selectedStudent.id,
        noteContent: noteForm.content,
        message: 'A mentor has added a sensitive note. Please approve or reject parent visibility.',
        createdAt: serverTimestamp(),
        read: false
      });
    }

    setNoteForm({ content: '', isConfidential: false, isSensitive: false, isParentVisible: true });
    fetchStudents();
  };

  const handleDeleteNote = async (noteIndex) => {
    if (!window.confirm('Delete this note?')) return;
    const notes = [...(selectedStudent.notes || [])];
    notes.splice(noteIndex, 1);
    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, { notes });
    fetchStudents();
  };

  const handleEditNoteStart = (index, note) => {
    setEditingNoteIndex(index);
    setEditNoteContent(note.content);
  };

  const handleEditNoteSave = async () => {
    const notes = [...(selectedStudent.notes || [])];
    notes[editingNoteIndex] = { ...notes[editingNoteIndex], content: editNoteContent };
    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, { notes });
    setEditingNoteIndex(null);
    setEditNoteContent('');
    fetchStudents();
  };

  const handleAddTask = async (e) => {
    e.preventDefault();

    const task = {
      title: taskForm.title,
      description: taskForm.description,
      dueDate: taskForm.dueDate,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, {
      tasks: arrayUnion(task)
    });

    // Notify student
    await addDoc(collection(db, 'notifications'), {
      type: 'task_assigned',
      studentEmail: selectedStudent.email,
      message: `New task assigned: ${task.title}`,
      createdAt: serverTimestamp(),
      read: false
    });

    setTaskForm({ title: '', description: '', dueDate: '' });
    setShowTaskForm(false);
    fetchStudents();
  };

  const handleDeleteTask = async (taskIndex) => {
    if (!window.confirm('Delete this task?')) return;
    const tasks = [...(selectedStudent.tasks || [])];
    tasks.splice(taskIndex, 1);
    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, { tasks });
    fetchStudents();
  };

  const handleEditTaskStart = (index, task) => {
    setEditingTaskIndex(index);
    setEditTaskForm({ title: task.title, description: task.description, dueDate: task.dueDate });
  };

  const handleEditTaskSave = async () => {
    const tasks = [...(selectedStudent.tasks || [])];
    tasks[editingTaskIndex] = { ...tasks[editingTaskIndex], ...editTaskForm };
    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, { tasks });
    setEditingTaskIndex(null);
    setEditTaskForm({ title: '', description: '', dueDate: '' });
    fetchStudents();
  };

  const handleAddMeeting = async (e) => {
    e.preventDefault();

    const inviteesArray = meetingForm.invitees === 'both'
      ? ['student', 'parent']
      : [meetingForm.invitees];

    const meetingIdForCall = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const meeting = {
      date: meetingForm.date,
      agenda: meetingForm.agenda,
      invitees: inviteesArray,
      meetingId: meetingIdForCall,
      status: 'pending',
      rescheduleCount: 0,
      createdAt: new Date().toISOString()
    };

    const studentRef = doc(db, 'students', selectedStudent.id);
    const updatedMeetings = [...(selectedStudent.meetings || []), meeting];
    await updateDoc(studentRef, { meetings: updatedMeetings });

    // Notify student if invited
    if (inviteesArray.includes('student')) {
      await addDoc(collection(db, 'notifications'), {
        type: 'meeting_scheduled',
        studentEmail: selectedStudent.email,
        message: `New meeting scheduled for ${meetingForm.date}: ${meetingForm.agenda}`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    // Notify parent if invited
    if (inviteesArray.includes('parent') && selectedStudent.parentEmail) {
      await addDoc(collection(db, 'notifications'), {
        type: 'meeting_scheduled',
        parentEmail: selectedStudent.parentEmail,
        studentEmail: selectedStudent.email,
        message: `A mentoring session for ${selectedStudent.name} has been scheduled for ${meetingForm.date}: ${meetingForm.agenda}`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    setMeetingForm({ date: '', agenda: '', invitees: 'student' });
    setShowMeetingForm(false);
    fetchStudents();
  };

  const handleGenerateReport = (student) => {
    generateStudentReport(student);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackText.trim() || !selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    await updateDoc(studentRef, {
      mentorFeedback: feedbackText
    });
    setFeedbackText('');
    fetchStudents();
  };

  // ── Meeting Requests ──
  const fetchMeetingRequests = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'meetingRequests'));
      const reqs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.status === 'pending');
      setMeetingRequests(reqs);
    } catch (err) {
      console.error('Error fetching meeting requests:', err);
    }
  };

  const handleApproveMeetingRequest = async (request) => {
    // Create the meeting on the student doc
    const studentRef = doc(db, 'students', request.studentId);
    const meeting = {
      date: request.date,
      time: request.time,
      agenda: request.reason,
      status: 'pending',
      rescheduleCount: 0,
      createdAt: new Date().toISOString(),
      requestedBy: request.requestedBy
    };

    const studentDoc = students.find(s => s.id === request.studentId);
    const updatedMeetings = [...(studentDoc?.meetings || []), meeting];
    await updateDoc(studentRef, { meetings: updatedMeetings });

    // Notify student
    await addDoc(collection(db, 'notifications'), {
      type: 'meeting_scheduled',
      studentEmail: request.studentEmail,
      message: `Your meeting request for ${request.date} at ${request.time} has been approved!`,
      createdAt: serverTimestamp(),
      read: false
    });

    // Notify parent
    if (request.parentEmail) {
      await addDoc(collection(db, 'notifications'), {
        type: 'meeting_scheduled',
        parentEmail: request.parentEmail,
        studentEmail: request.studentEmail,
        message: `Meeting for ${request.studentName} on ${request.date} at ${request.time} has been approved.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    // Delete the request
    await deleteDoc(doc(db, 'meetingRequests', request.id));
    fetchMeetingRequests();
    fetchStudents();
  };

  const handleDeclineMeetingRequest = async (request) => {
    // Notify requester
    const notifData = {
      type: 'meeting_declined',
      message: `Meeting request for ${request.date} at ${request.time} was declined by the mentor.`,
      createdAt: serverTimestamp(),
      read: false
    };

    if (request.requestedBy === 'parent') {
      notifData.parentEmail = request.parentEmail;
    } else {
      notifData.studentEmail = request.studentEmail;
    }
    await addDoc(collection(db, 'notifications'), notifData);

    await deleteDoc(doc(db, 'meetingRequests', request.id));
    fetchMeetingRequests();
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      email: student.email,
      parentEmail: student.parentEmail,
      attendance: student.attendance,
      marks: student.marks
    });
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();

    const newAttendance = parseFloat(editForm.attendance);
    const newMarks = parseFloat(editForm.marks);
    const risk = evaluateRiskChange(
      editingStudent.attendance, editingStudent.marks,
      newAttendance, newMarks
    );

    const updateData = {
      name: editForm.name,
      email: editForm.email,
      parentEmail: editForm.parentEmail,
      attendance: newAttendance,
      marks: newMarks,
      atRisk: risk.isAtRisk,
      history: arrayUnion({
        attendance: newAttendance,
        marks: newMarks,
        date: new Date().toISOString()
      })
    };

    // Log risk event if status changed
    if (risk.riskEvent) {
      updateData.riskEvents = arrayUnion(risk.riskEvent);
    }

    // Clear intervention if student recovered
    if (risk.recovered) {
      updateData.intervention = null;
    }

    const studentRef = doc(db, 'students', editingStudent.id);
    await updateDoc(studentRef, updateData);

    // If newly at risk, notify parent with escalation
    if (risk.newlyAtRisk) {
      await addDoc(collection(db, 'notifications'), {
        type: 'risk_alert',
        studentEmail: editForm.email,
        parentEmail: editForm.parentEmail,
        message: `⚠️ ${editForm.name} is now At-Risk. Attendance: ${newAttendance}% (${risk.attendanceStatus.toUpperCase()}), Marks: ${newMarks}% (${risk.marksStatus.toUpperCase()}). Immediate parent intervention may be required.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }

    setEditingStudent(null);
    setEditForm({ name: '', email: '', parentEmail: '', attendance: '', marks: '' });
    fetchStudents();
  };

  const handleInitiateIntervention = async () => {
    if (!selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    const interventionData = {
      initiated: true,
      date: new Date().toISOString(),
      note: interventionNote || 'Parent intervention initiated by mentor.',
      mentorId: currentUser.uid
    };
    await updateDoc(studentRef, { intervention: interventionData });

    // Notify parent
    await addDoc(collection(db, 'notifications'), {
      type: 'intervention_triggered',
      studentEmail: selectedStudent.email,
      parentEmail: selectedStudent.parentEmail,
      message: `🚨 Immediate Parent Intervention has been initiated for ${selectedStudent.name}. Reason: ${interventionData.note}`,
      createdAt: serverTimestamp(),
      read: false
    });

    setInterventionNote('');
    fetchStudents();
  };


  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, {
        deleted: true,
        deletedAt: serverTimestamp()
      });

      if (selectedStudent && selectedStudent.id === studentId) {
        setSelectedStudent(null);
      }
      fetchStudents();
    } catch (err) {
      alert('Failed to delete student: ' + err.message);
    }
  };

  const getNoteTypeBadge = (note) => {
    if (note.isConfidential) return { label: 'Confidential', color: '#6c757d', bg: '#e9ecef' };
    if (note.isSensitive) {
      if (note.approved === true) return { label: 'Sensitive ✓ Approved', color: '#155724', bg: '#d4edda' };
      if (note.approved === false) return { label: 'Sensitive ✗ Rejected', color: '#721c24', bg: '#f8d7da' };
      return { label: 'Sensitive ⏳ Pending', color: '#856404', bg: '#fff3cd' };
    }
    if (note.isParentVisible) return { label: 'Parent Visible', color: '#004085', bg: '#cce5ff' };
    return { label: 'Internal', color: '#383d41', bg: '#e2e3e5' };
  };

  return (
    <div>
      <div className="navbar">
        <h2>Mentor Dashboard</h2>
        <button className="btn btn-danger" onClick={logout}>Logout</button>
      </div>

      <div className="container">
        {/* Meeting Requests */}
        {meetingRequests.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #fd7e14' }}>
            <h3>📩 Meeting Requests ({meetingRequests.length})</h3>
            {meetingRequests.map(req => (
              <div key={req.id} style={{
                padding: '15px',
                background: '#fff8e1',
                borderRadius: '8px',
                marginBottom: '10px',
                borderLeft: '4px solid #ffc107'
              }}>
                <div className="flex-responsive" style={{ justifyContent: 'space-between', alignItems: 'start', gap: '15px' }}>
                  <div>
                    <p style={{ marginBottom: '5px' }}>
                      <strong>{req.studentName}</strong>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        marginLeft: '8px',
                        background: req.requestedBy === 'parent' ? '#e8f5e9' : '#e3f2fd',
                        color: req.requestedBy === 'parent' ? '#2e7d32' : '#1565c0'
                      }}>
                        From {req.requestedBy}
                      </span>
                    </p>
                    <p style={{ marginBottom: '5px', color: '#555' }}>
                      📅 {req.date} at {req.time}
                    </p>
                    <p style={{ marginBottom: '0', color: '#666', fontSize: '14px' }}>
                      <strong>Reason:</strong> {req.reason}
                    </p>
                  </div>
                  <div className="flex-responsive" style={{ gap: '8px', width: 'auto' }}>
                    <button
                      className="btn btn-success"
                      style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                      onClick={() => handleApproveMeetingRequest(req)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                      onClick={() => handleDeclineMeetingRequest(req)}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="flex-responsive" style={{ justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3>Students</h3>
            <div className="flex-responsive" style={{ gap: '10px' }}>
              <div style={{ position: 'relative', display: 'block', width: '100%' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  style={{ background: statusFilter !== 'all' ? '#28a745' : '#007bff', width: '100%' }}
                >
                  Filter {statusFilter !== 'all' && '✓'}
                </button>

                {showFilterDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 1000,
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '10px',
                    minWidth: '220px',
                    marginTop: '5px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px', padding: '0 5px' }}>Attendance</div>
                    <div className="filter-option" onClick={() => { setStatusFilter('lowAttendance'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#dc3545' }}></span> Low (&lt; 80%)
                    </div>
                    <div className="filter-option" onClick={() => { setStatusFilter('avgAttendance'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#ffc107' }}></span> Average (80-85%)
                    </div>
                    <div className="filter-option" onClick={() => { setStatusFilter('goodAttendance'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#28a745' }}></span> Good (&gt;= 85%)
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', margin: '12px 0 8px 0', padding: '0 5px' }}>Marks</div>
                    <div className="filter-option" onClick={() => { setStatusFilter('lowMarks'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#dc3545' }}></span> Low (&lt; 60%)
                    </div>
                    <div className="filter-option" onClick={() => { setStatusFilter('avgMarks'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#ffc107' }}></span> Average (60-75%)
                    </div>
                    <div className="filter-option" onClick={() => { setStatusFilter('goodMarks'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, background: '#28a745' }}></span> Good (&gt;= 75%)
                    </div>

                    <div style={{ borderTop: '1px solid #eee', margin: '10px 0' }}></div>
                    <div className="filter-option" onClick={() => { setStatusFilter('atRisk'); setShowFilterDropdown(false); }} style={filterOptionStyle}>
                      <span style={{ ...colorIndicator, border: '2px solid #dc3545', background: '#f8d7da' }}></span> ⚠️ At Risk
                    </div>
                    <div className="filter-option" onClick={() => { setStatusFilter('all'); setShowFilterDropdown(false); }} style={{ ...filterOptionStyle, color: '#007bff' }}>
                      <span style={{ ...colorIndicator, background: '#6c757d' }}></span> Show All
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                onClick={() => setShowCSVImport(!showCSVImport)}
                style={{ width: '100%' }}
              >
                {showCSVImport ? 'Hide' : 'Import CSV'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ width: '100%' }}>
                {showForm ? 'Cancel' : 'Add Student'}
              </button>
            </div>
          </div>

          {showCSVImport && (
            <CSVImport currentUser={currentUser} onImportComplete={fetchStudents} />
          )}

          {showForm && (
            <form onSubmit={handleAddStudent} style={{ marginBottom: '20px', background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
              <div className="form-group">
                <input
                  placeholder="Student Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Student Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Parent Email"
                  value={formData.parentEmail}
                  onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="number"
                  placeholder="Attendance %"
                  min="0"
                  max="100"
                  value={formData.attendance}
                  onChange={(e) => setFormData({ ...formData, attendance: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="number"
                  placeholder="Marks %"
                  min="0"
                  max="100"
                  value={formData.marks}
                  onChange={(e) => setFormData({ ...formData, marks: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-success">Save Student</button>
            </form>
          )}

          {/* Edit Student Form */}
          {editingStudent && (
            <form onSubmit={handleUpdateStudent} style={{ marginBottom: '20px', background: '#e8f4fd', padding: '20px', borderRadius: '8px', border: '2px solid #007bff' }}>
              <h4 style={{ marginBottom: '15px' }}>Edit Student: {editingStudent.name}</h4>
              <div className="form-group">
                <label>Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Parent Email</label>
                <input type="email" value={editForm.parentEmail} onChange={(e) => setEditForm({ ...editForm, parentEmail: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Attendance %</label>
                <input type="number" min="0" max="100" value={editForm.attendance} onChange={(e) => setEditForm({ ...editForm, attendance: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Marks %</label>
                <input type="number" min="0" max="100" value={editForm.marks} onChange={(e) => setEditForm({ ...editForm, marks: e.target.value })} required />
              </div>
              <div>
                <button type="submit" className="btn btn-success" style={{ marginRight: '10px' }}>Save Changes</button>
                <button type="button" className="btn btn-danger" onClick={() => setEditingStudent(null)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Attendance</th>
                  <th>Marks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>
                      <span className={`status-indicator status-${getStatusColor(student.attendance, 'attendance')}`}></span>
                      {student.attendance}%
                    </td>
                    <td>
                      <span className={`status-indicator status-${getStatusColor(student.marks, 'marks')}`}></span>
                      {student.marks}%
                    </td>
                    <td>
                      {getRiskStatus(student.attendance, student.marks) ? (
                        <div>
                          <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px', background: '#f8d7da', color: '#721c24', marginBottom: '4px' }}>
                            ⚠️ At Risk
                          </span>
                          {student.intervention?.initiated ? (
                            <span style={{ display: 'block', fontSize: '10px', color: '#856404', marginTop: '2px' }}>🔄 Intervention Active</span>
                          ) : (
                            <span style={{ display: 'block', fontSize: '10px', color: '#dc3545', marginTop: '2px' }}>🚨 Intervention Required</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '11px', borderRadius: '12px', background: '#d4edda', color: '#155724' }}>
                          ✓ Stable
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ marginRight: '5px', fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => setSelectedStudent(student)}
                      >
                        Manage
                      </button>
                      <button
                        className="btn btn-success"
                        style={{ marginRight: '5px', fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => handleGenerateReport(student)}
                      >
                        Report
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ marginRight: '5px', fontSize: '12px', padding: '6px 12px', background: '#17a2b8' }}
                        onClick={() => handleEditStudent(student)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedStudent && (
          <div className="manage-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedStudent(null); }}>
            <div className="manage-modal-content">
              <div className="manage-modal-header">
                <h3 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Manage: {selectedStudent.name}</h3>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => setSelectedStudent(null)}
                >
                  ✕ Close
                </button>
              </div>
              <div className="manage-modal-body">

                {/* Intervention Panel for At-Risk Students */}
                {getRiskStatus(selectedStudent.attendance, selectedStudent.marks) && (
                  <div style={{ margin: '15px 0', padding: '15px', borderRadius: '8px', background: selectedStudent.intervention?.initiated ? '#fff3cd' : '#f8d7da', border: `2px solid ${selectedStudent.intervention?.initiated ? '#ffc107' : '#dc3545'}` }}>
                    {selectedStudent.intervention?.initiated ? (
                      <div>
                        <h4 style={{ color: '#856404', marginBottom: '8px' }}>🔄 Intervention in Progress</h4>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>Initiated: {new Date(selectedStudent.intervention.date).toLocaleDateString()}</p>
                        <p style={{ fontSize: '13px', color: '#555' }}><strong>Note:</strong> {selectedStudent.intervention.note}</p>
                      </div>
                    ) : (
                      <div>
                        <h4 style={{ color: '#721c24', marginBottom: '8px' }}>🚨 Parent Intervention Required</h4>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                          Both attendance ({selectedStudent.attendance}%) and marks ({selectedStudent.marks}%) are critically low.
                        </p>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <textarea
                            placeholder="Intervention note (e.g., reason, recommended actions)"
                            value={interventionNote}
                            onChange={(e) => setInterventionNote(e.target.value)}
                            rows="2"
                            style={{ fontSize: '13px' }}
                          />
                        </div>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '12px' }}
                          onClick={handleInitiateIntervention}
                        >
                          🚨 Initiate Parent Intervention
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Notes */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <h4>Session Notes ({(selectedStudent.notes || []).length})</h4>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {['all', 'confidential', 'parentVisible', 'sensitive'].map(filter => (
                        <button
                          key={filter}
                          onClick={() => setNoteFilter(filter)}
                          style={{
                            fontSize: '11px', padding: '3px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: noteFilter === filter ? '#007bff' : '#e9ecef',
                            color: noteFilter === filter ? '#fff' : '#495057'
                          }}
                        >
                          {filter === 'all' ? 'All' : filter === 'confidential' ? '🔒 Confidential' : filter === 'parentVisible' ? '👁 Parent Visible' : '⚠ Sensitive'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(selectedStudent.notes || []).filter(note => {
                    if (noteFilter === 'all') return true;
                    if (noteFilter === 'confidential') return note.isConfidential;
                    if (noteFilter === 'parentVisible') return note.isParentVisible && !note.isConfidential;
                    if (noteFilter === 'sensitive') return note.isSensitive;
                    return true;
                  }).length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic', marginTop: '10px' }}>No notes yet</p>
                  ) : (
                    (selectedStudent.notes || []).filter(note => {
                      if (noteFilter === 'all') return true;
                      if (noteFilter === 'confidential') return note.isConfidential;
                      if (noteFilter === 'parentVisible') return note.isParentVisible && !note.isConfidential;
                      if (noteFilter === 'sensitive') return note.isSensitive;
                      return true;
                    }).map((note, index) => {
                      const badge = getNoteTypeBadge(note);
                      return (
                        <div key={index} style={{
                          padding: '12px',
                          background: '#f8f9fa',
                          borderRadius: '4px',
                          marginTop: '10px',
                          borderLeft: `4px solid ${badge.color}`
                        }}>
                          {editingNoteIndex === index ? (
                            <div>
                              <textarea
                                value={editNoteContent}
                                onChange={(e) => setEditNoteContent(e.target.value)}
                                rows="3"
                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                              <div style={{ marginTop: '8px' }}>
                                <button className="btn btn-success" style={{ fontSize: '12px', padding: '4px 10px', marginRight: '5px' }} onClick={handleEditNoteSave}>Save</button>
                                <button className="btn btn-danger" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setEditingNoteIndex(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <p style={{ marginBottom: '8px', flex: 1 }}>{note.content}</p>
                                <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                  <button className="btn btn-primary" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleEditNoteStart(index, note)}>Edit</button>
                                  <button className="btn btn-danger" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleDeleteNote(index)}>Delete</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                                <small style={{ color: '#999' }}>{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'Recent'}</small>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Note Form */}
                <div style={{ marginTop: '20px', padding: '15px', background: '#f0f7ff', borderRadius: '8px' }}>
                  <h4>Add New Note</h4>
                  <form onSubmit={handleAddNote}>
                    <div className="form-group">
                      <textarea
                        placeholder="Note content"
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        rows="3"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={noteForm.isConfidential}
                          onChange={(e) => setNoteForm({ ...noteForm, isConfidential: e.target.checked, isParentVisible: !e.target.checked })}
                        />
                        {' '}Confidential (Mentor only)
                      </label>
                    </div>
                    {!noteForm.isConfidential && (
                      <>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={noteForm.isSensitive}
                              onChange={(e) => setNoteForm({ ...noteForm, isSensitive: e.target.checked })}
                            />
                            {' '}Sensitive (Requires student approval)
                          </label>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={noteForm.isParentVisible}
                              onChange={(e) => setNoteForm({ ...noteForm, isParentVisible: e.target.checked })}
                            />
                            {' '}Parent Visible
                          </label>
                        </div>
                      </>
                    )}
                    <button type="submit" className="btn btn-primary">Add Note</button>
                  </form>
                </div>
                {/* TASKS SECTION */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4>Tasks ({(selectedStudent.tasks || []).length})</h4>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => setShowTaskForm(!showTaskForm)}
                    >
                      {showTaskForm ? 'Cancel' : '+ New Task'}
                    </button>
                  </div>

                  {/* Existing Tasks */}
                  {(selectedStudent.tasks || []).map((task, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        background: task.completed ? '#d4edda' : '#f8f9fa',
                        borderRadius: '4px',
                        marginTop: '10px',
                        borderLeft: task.completed ? '4px solid #28a745' : '4px solid #007bff'
                      }}
                    >
                      {editingTaskIndex === index ? (
                        <div>
                          <div className="form-group">
                            <input value={editTaskForm.title} onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })} placeholder="Title" />
                          </div>
                          <div className="form-group">
                            <textarea value={editTaskForm.description} onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })} rows="2" placeholder="Description" />
                          </div>
                          <div className="form-group">
                            <input type="date" value={editTaskForm.dueDate} onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })} />
                          </div>
                          <button className="btn btn-success" style={{ fontSize: '12px', padding: '4px 10px', marginRight: '5px' }} onClick={handleEditTaskSave}>Save</button>
                          <button className="btn btn-danger" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setEditingTaskIndex(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <h4 style={{ marginBottom: '5px' }}>{task.title}</h4>
                            <p style={{ color: '#666', marginBottom: '5px', fontSize: '14px' }}>{task.description}</p>
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
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className="btn btn-primary" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleEditTaskStart(index, task)}>Edit</button>
                            <button className="btn btn-danger" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleDeleteTask(index)}>Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {(selectedStudent.tasks || []).length === 0 && (
                    <p style={{ color: '#999', fontStyle: 'italic', marginTop: '10px' }}>No tasks assigned yet</p>
                  )}

                  {/* Add Task Form */}
                  {showTaskForm && (
                    <form onSubmit={handleAddTask} style={{ marginTop: '15px', padding: '15px', background: '#f0f7ff', borderRadius: '8px' }}>
                      <div className="form-group">
                        <input
                          placeholder="Task Title"
                          value={taskForm.title}
                          onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          placeholder="Task Description"
                          value={taskForm.description}
                          onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                          rows="3"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Due Date</label>
                        <input
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-success">Assign Task</button>
                    </form>
                  )}
                </div>

                {/* MEETINGS SECTION */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4>Meetings ({(selectedStudent.meetings || []).length})</h4>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => setShowMeetingForm(!showMeetingForm)}
                    >
                      {showMeetingForm ? 'Cancel' : '+ Schedule Meeting'}
                    </button>
                  </div>

                  {/* Existing Meetings */}
                  {(selectedStudent.meetings || []).map((meeting, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      background: meeting.status === 'accepted' ? '#d4edda' : meeting.status === 'rescheduled' ? '#fff3cd' : '#f8f9fa',
                      borderRadius: '4px',
                      marginTop: '10px',
                      borderLeft: `4px solid ${meeting.status === 'accepted' ? '#28a745' : meeting.status === 'rescheduled' ? '#ffc107' : '#6c757d'}`
                    }}>
                      <p><strong>Date:</strong> {meeting.date}</p>
                      {meeting.agenda && <p><strong>Agenda:</strong> {meeting.agenda}</p>}
                      <div style={{ display: 'flex', gap: '15px', marginTop: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <small style={{ color: '#666' }}>
                          <strong>Status:</strong> {meeting.status || 'pending'}
                        </small>
                        <small style={{ color: '#666' }}>
                          <strong>Reschedules:</strong> {meeting.rescheduleCount || 0}/2
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
                              meetingId: meeting.meetingId || `meeting_${selectedStudent.id}_${meeting.date}`,
                              userId: currentUser.uid,
                              userName: 'Mentor'
                            })}
                          >
                            📹 Join Call
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {(selectedStudent.meetings || []).length === 0 && (
                    <p style={{ color: '#999', fontStyle: 'italic', marginTop: '10px' }}>No meetings scheduled</p>
                  )}

                  {/* Schedule Meeting Form */}
                  {showMeetingForm && (
                    <form onSubmit={handleAddMeeting} style={{ marginTop: '15px', padding: '15px', background: '#f0f7ff', borderRadius: '8px' }}>
                      <div className="form-group">
                        <label>Meeting Date</label>
                        <input
                          type="date"
                          value={meetingForm.date}
                          onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Agenda</label>
                        <textarea
                          placeholder="Meeting agenda or topic"
                          value={meetingForm.agenda}
                          onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                          rows="2"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px' }}>Meeting With</label>
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="invitees"
                              value="student"
                              checked={meetingForm.invitees === 'student'}
                              onChange={(e) => setMeetingForm({ ...meetingForm, invitees: e.target.value })}
                            />
                            Student Only
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="invitees"
                              value="parent"
                              checked={meetingForm.invitees === 'parent'}
                              onChange={(e) => setMeetingForm({ ...meetingForm, invitees: e.target.value })}
                            />
                            Parent Only
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="invitees"
                              value="both"
                              checked={meetingForm.invitees === 'both'}
                              onChange={(e) => setMeetingForm({ ...meetingForm, invitees: e.target.value })}
                            />
                            Student & Parent
                          </label>
                        </div>
                      </div>
                      <button type="submit" className="btn btn-success">Schedule Meeting</button>
                    </form>
                  )}
                </div>

                {/* AI ASSISTANT SECTION */}
                <AIAssistant student={selectedStudent} />

                {/* MENTOR FEEDBACK SECTION */}
                <div className="card">
                  <h4>Mentor Feedback for Parents</h4>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
                    Write a short feedback summary visible to the student's parents.
                  </p>

                  {selectedStudent.mentorFeedback && (
                    <div style={{ padding: '12px', background: '#d4edda', borderRadius: '4px', marginBottom: '15px', borderLeft: '4px solid #28a745' }}>
                      <p style={{ marginBottom: '5px' }}><strong>Current Feedback:</strong></p>
                      <p style={{ marginBottom: 0 }}>{selectedStudent.mentorFeedback}</p>
                    </div>
                  )}

                  <div className="form-group">
                    <textarea
                      placeholder="Write feedback for parents (e.g., 'Aarav is showing great improvement in participation...')"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows="3"
                    />
                  </div>
                  <button
                    className="btn btn-success"
                    onClick={handleSaveFeedback}
                    disabled={!feedbackText.trim()}
                  >
                    Save Feedback
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Call Modal */}
      {
        activeCall && (
          <VideoCall
            meetingId={activeCall.meetingId}
            userId={activeCall.userId}
            userName={activeCall.userName}
            onClose={() => setActiveCall(null)}
          />
        )
      }
    </div>
  );
}

export default MentorDashboard;

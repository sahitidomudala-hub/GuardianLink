import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import { getStatusColor, getRiskStatus } from '../utils/riskLogic';
import { generateStudentReport } from '../utils/pdfGenerator';
import CSVImport from './CSVImport';

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

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);
    const studentsData = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(student => !student.deleted); // Filter out deleted students
    setStudents(studentsData);
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
      createdAt: new Date(),
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

  const handleAddTask = async (e) => {
    e.preventDefault();
    
    const task = {
      title: taskForm.title,
      description: taskForm.description,
      dueDate: taskForm.dueDate,
      completed: false,
      createdAt: new Date()
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

  const handleGenerateReport = (student) => {
    generateStudentReport(student);
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
    
    const studentRef = doc(db, 'students', editingStudent.id);
    await updateDoc(studentRef, {
      name: editForm.name,
      email: editForm.email,
      parentEmail: editForm.parentEmail,
      attendance: parseFloat(editForm.attendance),
      marks: parseFloat(editForm.marks)
    });

    setEditingStudent(null);
    setEditForm({ name: '', email: '', parentEmail: '', attendance: '', marks: '' });
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
      // Or use deleteDoc(studentRef) for permanent deletion
      
      fetchStudents();
      alert('Student deleted successfully');
    } catch (err) {
      alert('Failed to delete student: ' + err.message);
    }
  };

  return (
    <div>
      <div className="navbar">
        <h2>Mentor Dashboard</h2>
        <button className="btn btn-danger" onClick={logout}>Logout</button>
      </div>
      
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Students</h3>
            <div>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowCSVImport(!showCSVImport)}
                style={{ marginRight: '10px' }}
              >
                {showCSVImport ? 'Hide' : 'Import CSV'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
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
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="email" 
                  placeholder="Student Email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="email" 
                  placeholder="Parent Email" 
                  value={formData.parentEmail} 
                  onChange={(e) => setFormData({...formData, parentEmail: e.target.value})} 
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
                  onChange={(e) => setFormData({...formData, attendance: e.target.value})} 
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
                  onChange={(e) => setFormData({...formData, marks: e.target.value})} 
                  required 
                />
              </div>
              <button type="submit" className="btn btn-success">Save Student</button>
            </form>
          )}

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
              {students.map(student => (
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
                    {getRiskStatus(student.attendance, student.marks) && (
                      <span className="alert alert-danger" style={{ padding: '4px 8px', display: 'inline-block', fontSize: '12px' }}>
                        At Risk
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
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => handleGenerateReport(student)}
                    >
                      Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedStudent && (
          <>
            <div className="card">
              <h3>Manage: {selectedStudent.name}</h3>
              
              <div style={{ marginTop: '20px' }}>
                <h4>Add Session Note</h4>
                <form onSubmit={handleAddNote}>
                  <div className="form-group">
                    <textarea 
                      placeholder="Note content" 
                      value={noteForm.content} 
                      onChange={(e) => setNoteForm({...noteForm, content: e.target.value})} 
                      rows="4"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={noteForm.isConfidential} 
                        onChange={(e) => setNoteForm({...noteForm, isConfidential: e.target.checked, isParentVisible: !e.target.checked})} 
                      />
                      {' '}Confidential (Mentor only - not visible to parent or student)
                    </label>
                  </div>
                  {!noteForm.isConfidential && (
                    <>
                      <div className="form-group">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={noteForm.isSensitive} 
                            onChange={(e) => setNoteForm({...noteForm, isSensitive: e.target.checked})} 
                          />
                          {' '}Sensitive (Requires student approval for parent visibility)
                        </label>
                      </div>
                      <div className="form-group">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={noteForm.isParentVisible} 
                            onChange={(e) => setNoteForm({...noteForm, isParentVisible: e.target.checked})} 
                          />
                          {' '}Parent Visible
                        </label>
                      </div>
                    </>
                  )}
                  <button type="submit" className="btn btn-primary">Add Note</button>
                </form>
              </div>

              <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Assign Task</h4>
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setShowTaskForm(!showTaskForm)}
                  >
                    {showTaskForm ? 'Cancel' : 'New Task'}
                  </button>
                </div>
                
                {showTaskForm && (
                  <form onSubmit={handleAddTask} style={{ marginTop: '15px' }}>
                    <div className="form-group">
                      <input 
                        placeholder="Task Title" 
                        value={taskForm.title} 
                        onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <textarea 
                        placeholder="Task Description" 
                        value={taskForm.description} 
                        onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} 
                        rows="3"
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Due Date</label>
                      <input 
                        type="date" 
                        value={taskForm.dueDate} 
                        onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-success">Assign Task</button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MentorDashboard;

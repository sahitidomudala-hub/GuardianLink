import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

function CSVImport({ currentUser, onImportComplete }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const student = {};
        
        headers.forEach((header, index) => {
          student[header] = values[index];
        });

        try {
          await addDoc(collection(db, 'students'), {
            name: student.name || '',
            email: student.email || '',
            parentEmail: student.parentEmail || '',
            attendance: parseFloat(student.attendance) || 0,
            marks: parseFloat(student.marks) || 0,
            mentorId: currentUser.uid,
            notes: [],
            tasks: [],
            meetings: [],
            createdAt: serverTimestamp()
          });
          successCount++;
        } catch (err) {
          errorCount++;
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }

      setResult({
        success: successCount,
        errors: errorCount,
        errorDetails: errors
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setResult({
        success: 0,
        errors: 1,
        errorDetails: ['Failed to parse CSV: ' + err.message]
      });
    }

    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = 'name,email,parentEmail,attendance,marks\nJohn Doe,john@student.com,parent@example.com,85,75\nJane Smith,jane@student.com,parent2@example.com,90,80';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
      <h4>Bulk Import Students (CSV)</h4>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
        Upload a CSV file to add multiple students at once
      </p>

      <button 
        className="btn btn-primary" 
        onClick={downloadTemplate}
        style={{ marginBottom: '15px', fontSize: '13px', padding: '8px 16px' }}
      >
        Download CSV Template
      </button>

      <div className="form-group">
        <label>Upload CSV File</label>
        <input 
          type="file" 
          accept=".csv"
          onChange={handleFileUpload}
          disabled={importing}
        />
      </div>

      {importing && (
        <div className="alert alert-warning">
          Importing students... Please wait.
        </div>
      )}

      {result && (
        <div className={`alert ${result.errors > 0 ? 'alert-warning' : 'alert-success'}`}>
          <p><strong>Import Complete:</strong></p>
          <p>✓ Successfully imported: {result.success} students</p>
          {result.errors > 0 && (
            <>
              <p>✗ Failed: {result.errors} students</p>
              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer' }}>View errors</summary>
                <ul style={{ marginTop: '10px', fontSize: '12px' }}>
                  {result.errorDetails.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '15px', padding: '10px', background: 'white', borderRadius: '4px', fontSize: '13px' }}>
        <strong>CSV Format:</strong>
        <pre style={{ marginTop: '5px', fontSize: '12px' }}>
name,email,parentEmail,attendance,marks
John Doe,john@student.com,parent@example.com,85,75
        </pre>
      </div>
    </div>
  );
}

export default CSVImport;

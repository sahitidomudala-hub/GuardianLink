import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRiskStatus } from '../utils/riskLogic';

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
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const row = {};

        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        // Normalize column names (support both formats)
        const studentName = row['student_name'] || row['name'] || '';
        const studentEmail = row['student_email'] || row['email'] || '';
        const parentEmail = row['parent_email'] || row['parentemail'] || '';
        const attendance = parseFloat(row['attendance']) || 0;
        const marks = parseFloat(row['marks']) || 0;

        try {
          // Check for duplicate by email
          const dupeQ = query(collection(db, 'students'), where('email', '==', studentEmail));
          const dupeSnap = await getDocs(dupeQ);

          if (!dupeSnap.empty) {
            skippedCount++;
            errors.push(`Row ${i + 1}: ${studentEmail} already exists (skipped)`);
            continue;
          }

          // Create the student document
          await addDoc(collection(db, 'students'), {
            name: studentName,
            email: studentEmail,
            parentEmail: parentEmail,
            attendance: attendance,
            marks: marks,
            mentorId: currentUser.uid,
            notes: [],
            tasks: [],
            meetings: [],
            createdAt: serverTimestamp()
          });

          // Check risk and notify parent
          if (getRiskStatus(attendance, marks)) {
            await addDoc(collection(db, 'notifications'), {
              type: 'risk_alert',
              studentEmail: studentEmail,
              parentEmail: parentEmail,
              message: `${studentName} is at risk. Both attendance (${attendance}%) and marks (${marks}%) are critically low.`,
              createdAt: serverTimestamp(),
              read: false
            });
          }

          successCount++;
        } catch (err) {
          errorCount++;
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }

      setResult({
        success: successCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setResult({
        success: 0,
        skipped: 0,
        errors: 1,
        errorDetails: ['Failed to parse CSV: ' + err.message]
      });
    }

    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = 'student_name,student_email,parent_email,attendance,marks\nJohn Doe,john@student.com,parent@example.com,85,75\nJane Smith,jane@student.com,parent2@example.com,90,80';
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
        Upload a CSV file to add multiple students at once. Duplicates are automatically skipped.
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
          {result.skipped > 0 && (
            <p>⊘ Skipped (duplicates): {result.skipped} students</p>
          )}
          {result.errors > 0 && (
            <p>✗ Failed: {result.errors} students</p>
          )}
          {result.errorDetails.length > 0 && (
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer' }}>View details</summary>
              <ul style={{ marginTop: '10px', fontSize: '12px' }}>
                {result.errorDetails.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div style={{ marginTop: '15px', padding: '10px', background: 'white', borderRadius: '4px', fontSize: '13px' }}>
        <strong>CSV Format:</strong>
        <pre style={{ marginTop: '5px', fontSize: '12px' }}>
          student_name,student_email,parent_email,attendance,marks
          John Doe,john@student.com,parent@example.com,85,75
        </pre>
      </div>
    </div>
  );
}

export default CSVImport;

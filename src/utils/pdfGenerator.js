import jsPDF from 'jspdf';

export function generateStudentReport(student) {
  const doc = new jsPDF();
  let y = 20;

  // ── Header ──
  doc.setFontSize(20);
  doc.setTextColor(44, 62, 80);
  doc.text('GuardianLink', 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(127, 140, 141);
  doc.text('Monthly Student Progress Report', 105, y, { align: 'center' });
  y += 15;

  // ── Student Info ──
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Student: ${student.name}`, 20, y);
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 140, y);
  y += 8;
  doc.text(`Email: ${student.email}`, 20, y);
  y += 5;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // ── Performance Metrics ──
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Performance Metrics', 20, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  const attendanceColor = student.attendance >= 85 ? [40, 167, 69] : student.attendance >= 80 ? [255, 193, 7] : [220, 53, 69];
  const marksColor = student.marks >= 75 ? [40, 167, 69] : student.marks >= 60 ? [255, 193, 7] : [220, 53, 69];

  doc.setFillColor(...attendanceColor);
  doc.circle(25, y - 2, 3, 'F');
  doc.text(`Attendance: ${student.attendance}%`, 32, y);
  y += 8;

  doc.setFillColor(...marksColor);
  doc.circle(25, y - 2, 3, 'F');
  doc.text(`Marks (GPA): ${student.marks}%`, 32, y);
  y += 8;

  // Risk status
  const isAtRisk = student.attendance < 80 && student.marks < 60;
  if (isAtRisk) {
    doc.setTextColor(220, 53, 69);
    doc.text('STATUS: AT RISK - Immediate intervention required', 20, y);
  } else {
    doc.setTextColor(40, 167, 69);
    doc.text('STATUS: Good Standing', 20, y);
  }
  y += 5;

  // Divider
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // ── Session Notes ──
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Session Notes', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const notes = (student.notes || []).filter(n => !n.isConfidential);
  if (notes.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('No session notes recorded this period.', 20, y);
    y += 8;
  } else {
    notes.forEach((note, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const type = note.isConfidential ? 'Confidential' : note.isSensitive ? 'Sensitive' : 'General';
      const date = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'N/A';
      doc.setTextColor(100, 100, 100);
      doc.text(`${i + 1}. [${type}] ${date}`, 20, y);
      y += 5;
      doc.setTextColor(0, 0, 0);
      // Wrap long text
      const lines = doc.splitTextToSize(note.content, 165);
      doc.text(lines, 25, y);
      y += lines.length * 5 + 4;
    });
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // ── Tasks Summary ──
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Tasks Summary', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const tasks = student.tasks || [];
  if (tasks.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('No tasks assigned this period.', 20, y);
    y += 8;
  } else {
    const completed = tasks.filter(t => t.completed).length;
    doc.text(`Total: ${tasks.length}  |  Completed: ${completed}  |  Pending: ${tasks.length - completed}`, 20, y);
    y += 8;

    tasks.forEach((task, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const status = task.completed ? 'DONE' : 'PENDING';
      const statusColor = task.completed ? [40, 167, 69] : [255, 193, 7];
      doc.setTextColor(...statusColor);
      doc.text(`[${status}]`, 20, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`${task.title} — Due: ${task.dueDate || 'N/A'}`, 45, y);
      y += 6;
    });
  }
  y += 2;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // ── Meeting History ──
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Meeting History', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const meetings = student.meetings || [];
  if (meetings.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('No meetings scheduled this period.', 20, y);
    y += 8;
  } else {
    meetings.forEach((meeting, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const status = meeting.status || 'pending';
      doc.text(`${i + 1}. Date: ${meeting.date}  |  Status: ${status}  |  Reschedules: ${meeting.rescheduleCount || 0}`, 20, y);
      y += 5;
      if (meeting.agenda) {
        const lines = doc.splitTextToSize(`Agenda: ${meeting.agenda}`, 160);
        doc.setTextColor(80, 80, 80);
        doc.text(lines, 25, y);
        doc.setTextColor(0, 0, 0);
        y += lines.length * 5 + 3;
      } else {
        y += 3;
      }
    });
  }

  // ── Mentor Feedback ──
  if (student.mentorFeedback) {
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, 190, y);
    y += 10;

    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('Mentor Feedback', 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const feedbackLines = doc.splitTextToSize(student.mentorFeedback, 165);
    doc.text(feedbackLines, 20, y);
    y += feedbackLines.length * 5;
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by GuardianLink System', 105, 285, { align: 'center' });
    doc.text(`Page ${p} of ${pageCount}`, 190, 285, { align: 'right' });
  }

  // Save
  doc.save(`${student.name.replace(/\s+/g, '_')}_Report.pdf`);
}

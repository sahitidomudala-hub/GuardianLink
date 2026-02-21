export function getStatusColor(value, type) {
  if (type === 'attendance') {
    if (value >= 85) return 'green';
    if (value >= 80) return 'yellow';
    return 'red';
  }

  if (type === 'marks') {
    if (value >= 75) return 'green';
    if (value >= 60) return 'yellow';
    return 'red';
  }

  return 'green';
}

export function getRiskStatus(attendance, marks) {
  return attendance < 80 && marks < 60;
}

export function calculateGPA(marks) {
  if (marks >= 90) return 4.0;
  if (marks >= 80) return 3.0;
  if (marks >= 70) return 2.0;
  if (marks >= 60) return 1.0;
  return 0.0;
}

/**
 * Evaluate risk change when attendance or marks are updated.
 * Returns detailed risk assessment including status transitions.
 */
export function evaluateRiskChange(oldAttendance, oldMarks, newAttendance, newMarks) {
  const wasAtRisk = getRiskStatus(oldAttendance, oldMarks);
  const nowAtRisk = getRiskStatus(newAttendance, newMarks);

  const attendanceStatus = getStatusColor(newAttendance, 'attendance');
  const marksStatus = getStatusColor(newMarks, 'marks');

  const result = {
    attendanceStatus,
    marksStatus,
    isAtRisk: nowAtRisk,
    newlyAtRisk: !wasAtRisk && nowAtRisk,
    recovered: wasAtRisk && !nowAtRisk,
    riskEvent: null
  };

  if (result.newlyAtRisk) {
    result.riskEvent = {
      type: 'escalation',
      date: new Date().toISOString(),
      attendance: newAttendance,
      marks: newMarks,
      message: `Student flagged as At-Risk: Attendance ${newAttendance}% (${attendanceStatus}), Marks ${newMarks}% (${marksStatus})`
    };
  } else if (result.recovered) {
    result.riskEvent = {
      type: 'recovery',
      date: new Date().toISOString(),
      attendance: newAttendance,
      marks: newMarks,
      message: `Student recovered from At-Risk status: Attendance ${newAttendance}%, Marks ${newMarks}%`
    };
  }

  return result;
}

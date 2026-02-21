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

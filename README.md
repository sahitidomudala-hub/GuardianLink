# GuardianLink

Student monitoring system with role-based dashboards for Mentors, Students, and Parents.

## 🚀 Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

```bash
npm install
npm run dev
```

## ✨ Features

### Core Functionality
- ✅ Role-based authentication (Mentor/Student/Parent)
- ✅ Risk indicator system with color-coded metrics
- ✅ Automatic "At Risk" detection and parent alerts
- ✅ Session notes with confidentiality controls
- ✅ Task assignment and tracking
- ✅ Meeting scheduling with reschedule limits
- ✅ PDF report generation
- ✅ Real-time notifications
- ✅ RBAC security enforcement

### Risk Logic

**Attendance:**
- 🟢 Green: ≥ 85%
- 🟡 Yellow: 80-85%
- 🔴 Red: < 80%

**Marks:**
- 🟢 Green: ≥ 75%
- 🟡 Yellow: 60-74%
- 🔴 Red: < 60%

**At Risk Status:**
Student is marked "At Risk" when BOTH attendance < 80% AND marks < 60%
→ Triggers automatic parent notification

### Dashboards

**Mentor Dashboard:**
- Add/Edit/View students
- View color-coded performance metrics
- Add session notes (Confidential/Sensitive/Parent-visible)
- Assign tasks to students
- Generate monthly PDF reports

**Student Dashboard:**
- View GPA & attendance with color indicators
- View and complete assigned tasks
- Receive notifications
- Approve/reject sensitive notes for parent visibility
- Accept or reschedule meetings (max 2 times)

**Parent Dashboard:**
- View child's GPA and attendance
- See color-coded performance indicators
- View parent-visible notes only
- Receive risk notifications
- View assigned tasks and completion status
- RBAC enforced (can only access own child's data)

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Firebase (Authentication + Firestore)
- **PDF Generation:** jsPDF
- **Routing:** React Router v6
- **Styling:** Vanilla CSS

## 📁 Project Structure

```
guardianlink/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── MentorDashboard.jsx
│   │   ├── StudentDashboard.jsx
│   │   └── ParentDashboard.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── firebase/
│   │   └── config.js          # Add your Firebase config here
│   ├── utils/
│   │   ├── riskLogic.js
│   │   └── pdfGenerator.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── firestore.rules              # Deploy to Firebase Console
├── package.json
├── vite.config.js
├── SETUP.md                     # Detailed setup guide
└── README.md
```

## 🔐 Security

- Firestore security rules enforce role-based access control
- Parents can only access their own child's data
- Students can only access their own data
- Mentors can manage all students
- Confidential notes are never visible to parents or students
- Sensitive notes require student approval for parent visibility

## 🎯 Workflow Examples

### Adding a Student (Mentor)
1. Login as Mentor
2. Click "Add Student"
3. Enter student details + parent email
4. System automatically checks risk status
5. If at risk → Parent receives notification

### Note Approval (Student)
1. Mentor adds sensitive note
2. Student receives notification
3. Student approves or rejects parent visibility
4. If rejected → Mentor receives notification
5. If approved → Note becomes visible to parent

### Meeting Reschedule (Student)
1. Student receives meeting request
2. Can reschedule up to 2 times
3. Each reschedule notifies mentor
4. After 2 reschedules → Must accept

## 📊 Data Models

**User:**
```javascript
{
  email: string,
  role: 'mentor' | 'student' | 'parent',
  name: string,
  createdAt: timestamp
}
```

**Student:**
```javascript
{
  name: string,
  email: string,
  parentEmail: string,
  attendance: number,
  marks: number,
  mentorId: string,
  notes: Array<Note>,
  tasks: Array<Task>,
  meetings: Array<Meeting>,
  createdAt: timestamp
}
```

**Note:**
```javascript
{
  content: string,
  isConfidential: boolean,
  isSensitive: boolean,
  isParentVisible: boolean,
  approved: boolean | null,
  createdAt: date,
  mentorId: string
}
```

## 🚀 Deployment

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase login
firebase init hosting
firebase deploy
```

## 🎨 Future Enhancements

Easy to add:
- Email notifications via Cloud Functions
- File uploads with Firebase Storage
- Real-time chat between mentor/student
- Calendar integration
- Video call integration
- Analytics dashboard
- Mobile app (React Native)

## 📝 License

MIT License - Built for hackathon use

---

Built with ❤️ for GuardianLink Hackathon

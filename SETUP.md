# GuardianLink - Firebase Setup Guide

## 🚀 Quick Setup (10 minutes)

### Step 1: Create Firebase Project (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `guardianlink` (or your choice)
4. Disable Google Analytics (optional, faster setup)
5. Click "Create project"

### Step 2: Enable Authentication (1 minute)

1. In Firebase Console, go to **Authentication** → **Get Started**
2. Click **Sign-in method** tab
3. Enable **Email/Password**
4. Click **Save**

### Step 3: Create Firestore Database (1 minute)

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Select **Start in test mode** (we'll add security rules later)
3. Choose a location (closest to you)
4. Click **Enable**

### Step 4: Get Firebase Config (1 minute)

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Scroll down to "Your apps" section
3. Click the **Web icon** (`</>`)
4. Register app with nickname: `guardianlink-web`
5. Copy the `firebaseConfig` object

### Step 5: Add Config to Project (1 minute)

1. Open `src/firebase/config.js` in your code editor
2. Replace the placeholder config with your copied config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Step 6: Deploy Security Rules (1 minute)

1. In Firebase Console, go to **Firestore Database** → **Rules** tab
2. Copy content from `firestore.rules` file in your project
3. Paste into the Firebase Console rules editor
4. Click **Publish**

### Step 7: Install & Run (3 minutes)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open browser to `http://localhost:5173`

## ✅ You're Done!

### Test the Application

1. **Sign Up** as a Mentor first
2. **Add a Student** with parent email
3. **Sign Up** as Student (use the email you entered)
4. **Sign Up** as Parent (use the parent email you entered)

### Default Test Flow

**As Mentor:**
- Add student: name="John Doe", email="student@test.com", parentEmail="parent@test.com", attendance=75, marks=55
- Add session notes
- Assign tasks
- Generate PDF report

**As Student (student@test.com):**
- View performance metrics
- Approve/reject sensitive notes
- Complete tasks
- Accept/reschedule meetings

**As Parent (parent@test.com):**
- View child's performance
- See risk alerts (if attendance < 80% AND marks < 60%)
- Read parent-visible notes

## 🎯 Features Included

✅ Role-based authentication (Mentor/Student/Parent)
✅ Risk indicator system (Green/Yellow/Red)
✅ Automatic "At Risk" detection
✅ Session notes with confidentiality controls
✅ Task assignment and tracking
✅ Meeting scheduling with reschedule limits (max 2)
✅ PDF report generation
✅ Real-time notifications
✅ Parent intervention alerts
✅ Student approval workflow for sensitive notes
✅ RBAC security rules

## 🔒 Security

- Firestore security rules enforce role-based access
- Parents can only see their own child's data
- Students can only see their own data
- Mentors can manage all students
- Confidential notes are never visible to parents/students

## 📱 Production Deployment

When ready to deploy:

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting (optional)
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🆘 Troubleshooting

**Error: "Firebase config not found"**
- Make sure you replaced the placeholder config in `src/firebase/config.js`

**Error: "Permission denied"**
- Deploy the security rules from `firestore.rules` to Firebase Console

**Students/Parents can't see data**
- Make sure emails match exactly when creating students
- Check that parent email is entered when adding student

## 🎨 Customization

Want to add more features? Easy additions:
- Email notifications (Firebase Cloud Functions)
- File uploads (Firebase Storage)
- Chat system (Firestore real-time)
- Analytics dashboard (Firebase Analytics)
- Push notifications (Firebase Cloud Messaging)

## 📞 Support

For hackathon support, check:
- Firebase Docs: https://firebase.google.com/docs
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev

Good luck with your hackathon! 🚀

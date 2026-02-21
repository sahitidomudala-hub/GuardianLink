# GuardianLink - System Architecture

## 🏗️ Architecture Overview

GuardianLink uses a **modern serverless architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                    (React + Vite)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Mentor     │  │   Student    │  │   Parent     │     │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│           │                │                │               │
│           └────────────────┴────────────────┘               │
│                          │                                   │
│                    ┌─────▼─────┐                           │
│                    │  Firebase  │                           │
│                    │    SDK     │                           │
│                    └─────┬─────┘                           │
└──────────────────────────┼─────────────────────────────────┘
                           │
                           │ HTTPS/WSS
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                       BACKEND                               │
│                  (Firebase Services)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Auth      │  │  Firestore   │  │   Storage    │    │
│  │ (Identity)   │  │  (Database)  │  │   (Files)    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                          │                                   │
│                  ┌───────▼────────┐                         │
│                  │ Security Rules  │                         │
│                  │     (RBAC)      │                         │
│                  └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

### Frontend (`src/`)
```
src/
├── components/           # UI Components (Presentation Layer)
│   ├── Login.jsx        # Authentication UI
│   ├── Signup.jsx       # User registration
│   ├── MentorDashboard.jsx    # Mentor interface
│   ├── StudentDashboard.jsx   # Student interface
│   ├── ParentDashboard.jsx    # Parent interface
│   └── CSVImport.jsx    # Bulk data import
│
├── contexts/            # State Management (Business Logic)
│   └── AuthContext.jsx  # Authentication state & methods
│
├── utils/               # Helper Functions (Utilities)
│   ├── riskLogic.js     # Risk calculation algorithms
│   └── pdfGenerator.js  # Report generation
│
├── firebase/            # Backend Integration
│   └── config.js        # Firebase initialization
│
├── App.jsx              # Root component & routing
├── main.jsx             # Application entry point
└── index.css            # Global styles
```

### Backend (Firebase)
```
Backend/
├── firestore.rules      # Database security rules (RBAC)
├── firebase.json        # Firebase project configuration
└── src/firebase/config.js  # Backend connection setup
```

### Configuration & Documentation
```
Root/
├── package.json         # Dependencies & scripts
├── vite.config.js       # Build configuration
├── README.md            # Project overview
├── SETUP.md             # Setup instructions
├── FEATURES.md          # Feature documentation
├── TECH_STACK.md        # Technology choices
└── ARCHITECTURE.md      # This file
```

---

## 🔄 Data Flow

### 1. Authentication Flow
```
User Input → Login Component → AuthContext → Firebase Auth
                                                    ↓
                                            JWT Token Generated
                                                    ↓
                                            Store in Browser
                                                    ↓
                                        Redirect to Dashboard
```

### 2. Data Read Flow
```
Dashboard Component → Firestore Query → Security Rules Check
                                              ↓
                                        Rules Validate
                                              ↓
                                        Return Data
                                              ↓
                                    Update Component State
                                              ↓
                                        Re-render UI
```

### 3. Data Write Flow
```
User Action → Component → Firestore Write → Security Rules
                                                  ↓
                                          Validate Role
                                                  ↓
                                          Write to DB
                                                  ↓
                                      Real-time Update
                                                  ↓
                                    All Listeners Notified
```

---

## 🎯 Layer Responsibilities

### Presentation Layer (Components)
**Responsibility:** Display UI and handle user interactions
- Render data
- Capture user input
- Trigger actions
- Show loading/error states

**Files:** `src/components/*.jsx`

### Business Logic Layer (Contexts & Utils)
**Responsibility:** Application logic and state management
- Authentication state
- Data transformations
- Risk calculations
- PDF generation

**Files:** `src/contexts/*.jsx`, `src/utils/*.js`

### Data Layer (Firebase)
**Responsibility:** Data persistence and security
- Store user data
- Enforce access control
- Real-time synchronization
- Authentication

**Files:** `firestore.rules`, `src/firebase/config.js`

---

## 🔒 Security Architecture

### Multi-Layer Security

**Layer 1: Frontend Validation**
- Input validation
- Role-based UI rendering
- Client-side checks

**Layer 2: Firebase Authentication**
- JWT token validation
- Session management
- Secure password hashing

**Layer 3: Firestore Security Rules**
- Database-level access control
- Role-based permissions
- Data validation

### Security Rules Example
```javascript
// Mentors can read/write all students
allow read, write: if getUserRole() == 'mentor';

// Students can only read their own data
allow read: if getUserRole() == 'student' && 
               resource.data.email == request.auth.email;

// Parents can only read their child's data
allow read: if getUserRole() == 'parent' && 
               resource.data.parentEmail == request.auth.email;
```

---

## 📊 Database Schema

### Collections Structure

```
Firestore Database
│
├── users/                    # User accounts
│   └── {userId}
│       ├── email: string
│       ├── role: string
│       ├── name: string
│       └── createdAt: timestamp
│
├── students/                 # Student records
│   └── {studentId}
│       ├── name: string
│       ├── email: string
│       ├── parentEmail: string
│       ├── attendance: number
│       ├── marks: number
│       ├── mentorId: string
│       ├── notes: array
│       ├── tasks: array
│       └── meetings: array
│
└── notifications/            # Real-time notifications
    └── {notificationId}
        ├── type: string
        ├── studentEmail: string
        ├── parentEmail: string
        ├── message: string
        ├── read: boolean
        └── createdAt: timestamp
```

---

## 🚀 Deployment Architecture

### Development
```
Local Machine
├── Vite Dev Server (Port 5173)
└── Firebase Emulators (Optional)
```

### Production
```
Firebase Hosting
├── Static Assets (CDN)
├── Firebase Authentication
├── Cloud Firestore
└── Security Rules
```

### Deployment Command
```bash
npm run build          # Build production bundle
firebase deploy        # Deploy to Firebase Hosting
```

---

## ⚡ Performance Optimizations

### Frontend
- **Vite HMR** - Hot module replacement for instant updates
- **Code Splitting** - Lazy load routes
- **React Memoization** - Prevent unnecessary re-renders
- **Client-side PDF** - No server processing needed

### Backend
- **Firestore Indexes** - Fast query performance
- **Real-time Listeners** - No polling overhead
- **CDN Distribution** - Global edge caching
- **Serverless** - Auto-scaling

---

## 🔄 Real-Time Features

### How Real-Time Works
```
Mentor adds student with low scores
        ↓
Firestore write operation
        ↓
Real-time listener triggers
        ↓
Parent dashboard updates automatically
        ↓
Notification appears instantly
```

### Implementation
```javascript
// Real-time listener
onSnapshot(collection(db, 'students'), (snapshot) => {
  // Automatically called when data changes
  updateUI(snapshot.docs);
});
```

---

## 🎨 Design Patterns Used

### 1. Context Pattern
- **Purpose:** Global state management
- **Usage:** Authentication state
- **File:** `src/contexts/AuthContext.jsx`

### 2. Component Composition
- **Purpose:** Reusable UI components
- **Usage:** Dashboard layouts
- **Files:** `src/components/*.jsx`

### 3. Custom Hooks
- **Purpose:** Reusable logic
- **Usage:** `useAuth()` hook
- **File:** `src/contexts/AuthContext.jsx`

### 4. Protected Routes
- **Purpose:** Role-based access
- **Usage:** Dashboard routing
- **File:** `src/App.jsx`

---

## 📈 Scalability

### Current Capacity (Free Tier)
- 50,000 reads/day
- 20,000 writes/day
- 1GB storage
- 10GB bandwidth/month

### Scaling Strategy
1. **Horizontal Scaling** - Firebase auto-scales
2. **Caching** - Browser caching + CDN
3. **Indexes** - Optimize queries
4. **Cloud Functions** - Add serverless compute if needed

---

## 🔮 Extension Points

### Easy to Add
- **Cloud Functions** - Backend logic (email notifications)
- **Firebase Storage** - File uploads
- **Cloud Messaging** - Push notifications
- **Analytics** - User behavior tracking

### Integration Ready
- **Payment Gateway** - Stripe/Razorpay
- **Video Calls** - Agora/Twilio
- **AI Features** - OpenAI API
- **SMS** - Twilio

---

## 🎯 Why This Architecture?

### ✅ Advantages
1. **No Server Management** - Serverless = zero DevOps
2. **Real-Time by Default** - Firestore syncs automatically
3. **Secure by Design** - Security rules at DB level
4. **Fast Development** - Focus on features, not infrastructure
5. **Cost-Effective** - Pay only for what you use
6. **Globally Distributed** - Firebase CDN worldwide
7. **Production-Ready** - Enterprise-grade from day 1

### 📊 Comparison with Traditional Architecture

| Aspect | Traditional (MERN) | GuardianLink (Firebase) |
|--------|-------------------|------------------------|
| Backend Setup | Hours | Minutes |
| Server Management | Required | None |
| Scaling | Manual | Automatic |
| Real-time | Complex (Socket.io) | Built-in |
| Security | Manual | Rule-based |
| Cost (Small Scale) | $5-20/month | Free |
| Deployment | Complex | One command |

---

## 📝 Summary

GuardianLink uses a **modern, serverless, three-tier architecture**:

1. **Presentation Tier** - React components for UI
2. **Business Logic Tier** - Contexts and utilities
3. **Data Tier** - Firebase services with security rules

This architecture provides:
- ⚡ Fast development
- 🔒 Security by default
- 📈 Automatic scaling
- 💰 Cost efficiency
- 🚀 Production readiness

**Perfect for hackathons, MVPs, and real-world applications!**

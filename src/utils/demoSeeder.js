import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getRiskStatus } from './riskLogic';

const DEMO_PASSWORD = 'demo123';

const DEMO_MENTOR = {
  name: 'Dr. Meera Rao',
  email: 'mentor@guardianlink.edu',
  role: 'mentor'
};

const DEMO_STUDENTS = [
  {
    name: 'Aarav Sharma',
    email: 'aarav@student.edu',
    parentEmail: 'parent.aarav@guardianlink.edu',
    attendance: 92,
    marks: 81
  },
  {
    name: 'Riya Patel',
    email: 'riya@student.edu',
    parentEmail: 'parent.riya@guardianlink.edu',
    attendance: 78,
    marks: 65
  },
  {
    name: 'Kabir Singh',
    email: 'kabir@student.edu',
    parentEmail: 'parent.kabir@guardianlink.edu',
    attendance: 68,
    marks: 55
  }
];

const DEMO_PARENTS = [
  { name: 'Parent of Aarav', email: 'parent.aarav@guardianlink.edu', role: 'parent' },
  { name: 'Parent of Riya', email: 'parent.riya@guardianlink.edu', role: 'parent' },
  { name: 'Parent of Kabir', email: 'parent.kabir@guardianlink.edu', role: 'parent' }
];

// Create or get a Firebase Auth account. Always signs out afterward.
async function ensureAuthAccount(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await signOut(auth);
    return { uid, isNew: true };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      await signOut(auth);
      return { uid, isNew: false };
    }
    throw err;
  }
}

// Sign in as a user and write their own user doc (create or update)
async function writeUserDoc(email, password, uid, data) {
  await signInWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', uid), data);
  await signOut(auth);
}

export async function seedDemoData(onProgress) {
  const log = (msg) => onProgress && onProgress(msg);

  try {
    // ── STEP 1: Ensure all Auth accounts exist ──

    log('Creating mentor account...');
    const mentor = await ensureAuthAccount(DEMO_MENTOR.email, DEMO_PASSWORD);
    log(mentor.isNew ? '✓ Mentor created' : '✓ Mentor ready');

    const parentAccounts = {};
    for (const parent of DEMO_PARENTS) {
      log(`Creating parent: ${parent.email}...`);
      const result = await ensureAuthAccount(parent.email, DEMO_PASSWORD);
      parentAccounts[parent.email] = result;
      log(result.isNew ? `✓ ${parent.email} created` : `✓ ${parent.email} ready`);
    }

    const studentAccounts = {};
    for (const student of DEMO_STUDENTS) {
      log(`Creating student: ${student.email}...`);
      const result = await ensureAuthAccount(student.email, DEMO_PASSWORD);
      studentAccounts[student.email] = result;
      log(result.isNew ? `✓ ${student.email} created` : `✓ ${student.email} ready`);
    }

    // ── STEP 2: Each user writes their OWN user doc ──

    log('Writing user profiles...');

    // Mentor writes their own doc
    await writeUserDoc(DEMO_MENTOR.email, DEMO_PASSWORD, mentor.uid, {
      email: DEMO_MENTOR.email,
      role: DEMO_MENTOR.role,
      name: DEMO_MENTOR.name,
      createdAt: new Date()
    });
    log('✓ Mentor profile saved');

    // Each parent writes their own doc
    for (const parent of DEMO_PARENTS) {
      await writeUserDoc(parent.email, DEMO_PASSWORD, parentAccounts[parent.email].uid, {
        email: parent.email,
        role: parent.role,
        name: parent.name,
        createdAt: new Date()
      });
    }
    log('✓ Parent profiles saved');

    // Each student writes their own doc
    for (const student of DEMO_STUDENTS) {
      await writeUserDoc(student.email, DEMO_PASSWORD, studentAccounts[student.email].uid, {
        email: student.email,
        role: 'student',
        name: student.name,
        createdAt: new Date()
      });
    }
    log('✓ Student profiles saved');

    // ── STEP 3: Mentor writes student data + notifications ──

    log('Populating student data...');
    await signInWithEmailAndPassword(auth, DEMO_MENTOR.email, DEMO_PASSWORD);

    for (const student of DEMO_STUDENTS) {
      // Check if student data doc already exists
      const existingQ = query(collection(db, 'students'), where('email', '==', student.email));
      const existingSnap = await getDocs(existingQ);

      if (existingSnap.empty) {
        await addDoc(collection(db, 'students'), {
          name: student.name,
          email: student.email,
          parentEmail: student.parentEmail,
          attendance: student.attendance,
          marks: student.marks,
          mentorId: mentor.uid,
          notes: [],
          tasks: [],
          meetings: [],
          createdAt: serverTimestamp()
        });

        if (getRiskStatus(student.attendance, student.marks)) {
          await addDoc(collection(db, 'notifications'), {
            type: 'risk_alert',
            studentEmail: student.email,
            parentEmail: student.parentEmail,
            message: `${student.name} is at risk. Both attendance (${student.attendance}%) and marks (${student.marks}%) are critically low.`,
            createdAt: serverTimestamp(),
            read: false
          });
          log(`⚠ Risk notification created for ${student.name}'s parent`);
        }

        log(`✓ ${student.name} data created`);
      } else {
        log(`✓ ${student.name} data already exists`);
      }
    }

    await signOut(auth);

    log('');
    log('✅ Demo data loaded successfully!');
    log('');
    log('Login credentials (all use password: demo123):');
    log('  Mentor: mentor@guardianlink.edu');
    log('  Students: aarav@student.edu, riya@student.edu, kabir@student.edu');
    log('  Parents: parent.aarav@, parent.riya@, parent.kabir@guardianlink.edu');

    return true;
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    try { await signOut(auth); } catch (e) { /* ignore */ }
    return false;
  }
}

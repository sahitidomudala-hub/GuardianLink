import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMpF2Megmz7arQqexzvF_wRnNrv7DvAQQ",
  authDomain: "guardianlink-2e003.firebaseapp.com",
  projectId: "guardianlink-2e003",
  storageBucket: "guardianlink-2e003.firebasestorage.app",
  messagingSenderId: "283543664980",
  appId: "1:283543664980:web:ea77275f31d110fbff70c1",
  measurementId: "G-5G5MFXMXCP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Users should create a .env file or hardcode keys here for testing
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDummyKey",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "dummy.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "dummy.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Detect if we are using the placeholder key
export const isMock = firebaseConfig.apiKey === "AIzaSyDummyKey" || !firebaseConfig.apiKey;

let app;
let auth: Auth | undefined;
let db: Firestore | undefined;
let googleProvider: GoogleAuthProvider | undefined;

if (!isMock) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  // console.warn("⚠️ Finanzas Glass: Running in DEMO MODE (Local Storage) because no valid Firebase API Key was found.");
}

export { app, auth, db, googleProvider };
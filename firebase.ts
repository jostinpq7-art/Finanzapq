import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Users should create a .env file or hardcode keys here for testing
const firebaseConfig = {
   apiKey: "AIzaSyCK8ztIW4AAmGIzNP8RCPzvvk72vy9ebyg",
  authDomain: "finanzas-pq.firebaseapp.com",
  projectId: "finanzas-pq",
  storageBucket: "finanzas-pq.firebasestorage.app",
  messagingSenderId: "202085156132",
  appId: "1:202085156132:web:f054d60e873248e9f49fb1",
  measurementId: "G-PGYLQJGPDK"
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
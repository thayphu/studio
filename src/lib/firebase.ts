
// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyB3CMin0DuVQBFi5qEPUhR_KZTP9hCfGg8", // REPLACE THIS
  authDomain: "hoedu-manager.firebaseapp.com", // REPLACE THIS
  projectId: "hoedu-manager", // REPLACE THIS
  storageBucket: "hoedu-manager.firebasestorage.app", // REPLACE THIS
  messagingSenderId: "491084366496", // REPLACE THIS
  appId: "1:491084366496:web:463cdf1b33815ce9263fc5" // REPLACE THIS
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);

export { app, db };

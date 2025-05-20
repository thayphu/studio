
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: REPLACE ALL "YOUR_..." VALUES WITH YOUR ACTUAL FIREBASE CONFIGURATION FOR THE "hoedu-manager" PROJECT
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY", // Replace with your actual API key
  authDomain: "hoedu-manager.firebaseapp.com", // Or your actual authDomain
  projectId: "hoedu-manager", // This MUST be "hoedu-manager"
  storageBucket: "hoedu-manager.appspot.com", // Or your actual storageBucket
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID", // Replace with your actual Sender ID
  appId: "YOUR_FIREBASE_APP_ID" // Replace with your actual App ID
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("[firebase.ts] Firebase initialized with projectId:", firebaseConfig.projectId);
} else {
  app = getApp();
  console.log("[firebase.ts] Firebase app already initialized, using existing app with projectId:", app.options.projectId);
  // Defensive check if the existing app has the wrong config (can happen in some HMR scenarios)
  if (app.options.projectId !== firebaseConfig.projectId) {
    console.warn("[firebase.ts] WARNING: Existing Firebase app projectId mismatch! Expected:", firebaseConfig.projectId, "Got:", app.options.projectId, "This might indicate an issue with HMR or environment setup.");
    // In a real scenario, you might want to force re-initialization or throw an error,
    // but for this context, logging a warning is a start.
  }
}

const db: Firestore = getFirestore(app);

export { app, db };

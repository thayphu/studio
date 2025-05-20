
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: REPLACE ALL "YOUR_..." VALUES WITH YOUR ACTUAL FIREBASE CONFIGURATION FOR THE "hoedu-manager" PROJECT
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY", // Replace with your actual API key from Firebase Console
  authDomain: "hoedu-manager.firebaseapp.com", // Or your actual authDomain if different
  projectId: "hoedu-manager", // This MUST be "hoedu-manager"
  storageBucket: "hoedu-manager.appspot.com", // Or your actual storageBucket if different
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
  // Defensive check for projectId mismatch, especially in dev environments with HMR
  if (app.options.projectId !== firebaseConfig.projectId) {
    console.warn(
      `[firebase.ts] WARNING: Firebase app projectId mismatch! Expected: ${firebaseConfig.projectId}, Got: ${app.options.projectId}. This can occur due to HMR or incorrect/cached configuration. Ensure your firebaseConfig object is correct and restart the dev server.`
    );
    // Forcing re-initialization for the default app is tricky and not standard.
    // The primary solution is to ensure the firebaseConfig object is correct from the start.
    // If issues persist, deleting .next and node_modules and reinstalling might be needed.
  } else {
     console.log("[firebase.ts] Firebase app already initialized, using existing app with projectId:", app.options.projectId);
  }
}

const db: Firestore = getFirestore(app);

export { app, db };


// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // PASTE YOUR ACTUAL API KEY HERE
  authDomain: "YOUR_AUTH_DOMAIN", // PASTE YOUR ACTUAL AUTH DOMAIN HERE
  projectId: "YOUR_PROJECT_ID", // PASTE YOUR ACTUAL PROJECT ID HERE
  storageBucket: "YOUR_STORAGE_BUCKET", // PASTE YOUR ACTUAL STORAGE BUCKET HERE
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // PASTE YOUR ACTUAL MESSAGING SENDER ID HERE
  appId: "YOUR_APP_ID" // PASTE YOUR ACTUAL APP ID HERE
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);

export { app, db };


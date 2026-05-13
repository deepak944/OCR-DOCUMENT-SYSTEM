import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0H5p-wFx90SYSZ5Loz91AdouL1vQHbFU",
  authDomain: "ocr-project-f7d37.firebaseapp.com",
  projectId: "ocr-project-f7d37",
  storageBucket: "ocr-project-f7d37.firebasestorage.app",
  messagingSenderId: "476956724417",
  appId: "1:476956724417:web:cb2f4d1fce26aaa0649840",
  measurementId: "G-JEQ1DFGK6K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
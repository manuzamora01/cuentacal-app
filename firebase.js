import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Pega AQUÍ el objeto que copiaste de la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAAHbbyXDhb7acMxUYWGbH5K0GIpyGWGho",
  authDomain: "cuentacal.firebaseapp.com",
  projectId: "cuentacal",
  storageBucket: "cuentacal.firebasestorage.app",
  messagingSenderId: "822546542231",
  appId: "1:822546542231:web:5b292c41fbab70d3d8c3d2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
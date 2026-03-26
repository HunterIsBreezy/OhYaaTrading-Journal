// Firebase v9 compat SDK — matches the original CDN-based compat API
// (db.collection(), auth.signInWithEmailAndPassword(), etc.)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCVh51PQ4IgSR7b-I6JtZgv42X2-03vJeo",
  authDomain: "trading-journal-86e97.firebaseapp.com",
  projectId: "trading-journal-86e97",
  storageBucket: "trading-journal-86e97.firebasestorage.app",
  messagingSenderId: "928347541219",
  appId: "1:928347541219:web:44f62f5034fc91e476bfd6",
  measurementId: "G-S8NTTW1NNR",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const functions = firebase.functions();
export { firebase };
export default firebase;

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmurN-lAxPM2PmxlzvKgZxBaDQpfi9J4M",
  authDomain: "sports-app-321aa.firebaseapp.com",
  projectId: "sports-app-321aa",
  storageBucket: "sports-app-321aa.appspot.com",
  messagingSenderId: "706753919426",
  appId: "1:706753919426:web:4f991c2979de62fed33e5b",
  measurementId: "G-G3CTMK85H0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // ⭐️ 新增 Storage 初始化

export { app, analytics, db, auth, storage }; // ⭐️ 新增 storage 匯出
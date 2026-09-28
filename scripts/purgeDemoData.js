import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
});

const auth = getAuth(app);

// Credentials come from the environment so no password lives in the repo:
//   SCRIPT_EMAIL=you@example.com SCRIPT_PASSWORD=... node scripts/<name>.js
const scriptEmail = process.env.SCRIPT_EMAIL || env.SCRIPT_EMAIL;
const scriptPassword = process.env.SCRIPT_PASSWORD || env.SCRIPT_PASSWORD;
if (!scriptEmail || !scriptPassword) {
  console.error('Set SCRIPT_EMAIL and SCRIPT_PASSWORD before running this script.');
  process.exit(1);
}
const db = getFirestore(app);

async function purge() {
  const cred = await signInWithEmailAndPassword(auth, scriptEmail, scriptPassword);
  const uid = cred.user.uid;
  console.log('Logged in as:', cred.user.email, uid);

  const linksSnap = await getDocs(collection(db, 'users', uid, 'schoolLinks'));
  for (const l of linksSnap.docs) {
    const schoolId = l.data().schoolId || l.id;
    console.log('Purging school subcollections for:', schoolId);

    const subcols = ['students', 'staff', 'classes', 'events', 'tasks'];
    for (const sub of subcols) {
      const snap = await getDocs(collection(db, 'schools', schoolId, sub));
      console.log(`  Deleting ${snap.size} items from ${sub}...`);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
    console.log('  Done purging school subcollections for:', schoolId);
  }

  console.log('ALL DEMO DATA HAS BEEN COMPLETELY PURGED FROM FIRESTORE!');
}

purge().then(() => process.exit(0)).catch(err => {
  console.error('Error purging:', err);
  process.exit(1);
});

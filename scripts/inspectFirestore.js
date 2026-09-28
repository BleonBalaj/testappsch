import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
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

async function inspect() {
  const cred = await signInWithEmailAndPassword(auth, scriptEmail, scriptPassword);
  const uid = cred.user.uid;
  console.log('Logged in as:', cred.user.email, uid);

  // 1. Inspect user doc
  const userDocSnap = await getDoc(doc(db, 'users', uid));
  if (userDocSnap.exists()) {
    console.log('User doc data:', JSON.stringify({
      email: userDocSnap.data().email,
      name: userDocSnap.data().name,
      displayName: userDocSnap.data().displayName,
      photoURL: userDocSnap.data().photoURL ? userDocSnap.data().photoURL.slice(0, 30) + '...' : null
    }));
  } else {
    console.log('User doc does not exist!');
  }

  // 2. Inspect school links
  const linksSnap = await getDocs(collection(db, 'users', uid, 'schoolLinks'));
  console.log('School links count:', linksSnap.size);
  for (const l of linksSnap.docs) {
    const schoolId = l.data().schoolId || l.id;
    console.log('Linked school:', schoolId, l.data());

    // Check school doc
    const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
    if (schoolSnap.exists()) {
      console.log('  School doc data:', schoolSnap.data().name, schoolSnap.data().rolePermissions);
    }

    // Inspect subcollections
    const subcols = ['students', 'staff', 'classes', 'events', 'tasks'];
    for (const sub of subcols) {
      const snap = await getDocs(collection(db, 'schools', schoolId, sub));
      console.log(`  Subcollection ${sub}: ${snap.size} items`);
      snap.forEach(d => {
        console.log(`    [${sub}] id=${d.id}`, JSON.stringify(d.data().name || d.data().title || d.data().subject || d.id));
      });
    }
  }
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

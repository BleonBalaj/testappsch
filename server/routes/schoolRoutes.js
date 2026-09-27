import { Router } from 'express';
import { db, FieldValue } from '../firebaseAdmin.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = Router();

const DEFAULT_SCHOOL_ROLES = [
  { id: 'admin', name: 'Administrator', category: 'Administration', color: '335 70% 65%', icon: 'Shield', description: 'Full access to school systems, staff management & policies' },
  { id: 'teacher', name: 'Teacher', category: 'Academic', color: '142 70% 45%', icon: 'GraduationCap', description: 'Curriculum delivery, student assessments, class management' },
  { id: 'counselor', name: 'Academic Counselor', category: 'Student Support', color: '270 65% 60%', icon: 'HeartHandshake', description: 'Student guidance, mental wellness, academic planning' },
  { id: 'dept_head', name: 'Head of Department', category: 'Academic Leadership', color: '215 85% 60%', icon: 'Award', description: 'Department curriculum supervision and faculty leadership' },
  { id: 'support', name: 'Staff / Specialist', category: 'Support', color: '38 92% 50%', icon: 'Briefcase', description: 'Operational support, lab management, and student services' }
];

// Provision a new school tenant
router.post('/create', verifyFirebaseToken, async (req, res) => {
  const { schoolName, academicYear } = req.body;
  const uid = req.user.uid;
  const email = req.user.email || '';
  const name = req.user.name || email.split('@')[0];

  if (!schoolName || typeof schoolName !== 'string' || !schoolName.trim()) {
    return res.status(400).json({ error: 'School name is required' });
  }

  const cleanName = schoolName.trim();
  const schoolId = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = FieldValue.serverTimestamp();

  try {
    const batch = db.batch();

    // 1. Ensure user profile document exists
    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      uid,
      email,
      displayName: name,
      updatedAt: now
    }, { merge: true });

    // 2. School document
    const schoolRef = db.collection('schools').doc(schoolId);
    batch.set(schoolRef, {
      id: schoolId,
      name: cleanName,
      creatorUid: uid,
      creatorEmail: email,
      academicYear: academicYear?.trim() || '2024-2025',
      createdAt: now,
      updatedAt: now,
      settings: {
        branding: { primaryColor: '335 70% 70%' },
        timezone: 'America/New_York'
      }
    });

    // 3. Creator membership (Admin role)
    const memberRef = schoolRef.collection('members').doc(uid);
    batch.set(memberRef, {
      uid,
      email,
      name,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 4. User's school link
    const linkRef = userRef.collection('schoolLinks').doc(schoolId);
    batch.set(linkRef, {
      schoolId,
      schoolName: cleanName,
      role: 'admin',
      status: 'active',
      joinedAt: now
    });

    // 5. Default roles for the school
    for (const r of DEFAULT_SCHOOL_ROLES) {
      const roleRef = schoolRef.collection('roles').doc(r.id);
      batch.set(roleRef, { ...r, createdAt: now });
    }

    // 6. Initial school preferences for this user
    const prefRef = userRef.collection('schoolPreferences').doc(schoolId);
    batch.set(prefRef, {
      schoolId,
      lessonInterval: 15,
      rememberLastUsed: false,
      updatedAt: now
    }, { merge: true });

    await batch.commit();

    return res.status(201).json({
      success: true,
      schoolId,
      schoolName: cleanName,
      role: 'admin'
    });
  } catch (error) {
    console.error('Error provisioning school:', error);
    return res.status(500).json({ error: 'Failed to create school. ' + error.message });
  }
});

// List all schools the authenticated user is a member of
router.get('/my-schools', verifyFirebaseToken, async (req, res) => {
  const uid = req.user.uid;
  try {
    const snap = await db.collection('users').doc(uid).collection('schoolLinks').get();
    const schools = [];
    snap.forEach(doc => {
      schools.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ schools });
  } catch (error) {
    console.error('Error fetching user school links:', error);
    return res.status(500).json({ error: 'Failed to fetch school links' });
  }
});

export default router;

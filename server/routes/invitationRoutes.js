import { Router } from 'express';
import crypto from 'crypto';
import { db, FieldValue } from '../firebaseAdmin.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = Router();

// Helper to check if caller is an admin of the specified school
async function checkSchoolAdmin(schoolId, uid) {
  const memberSnap = await db.collection('schools').doc(schoolId).collection('members').doc(uid).get();
  if (!memberSnap.exists) return false;
  const data = memberSnap.data();
  return data.role === 'admin' && data.status === 'active';
}

// 1. Create invitation (Admin only)
router.post('/schools/:schoolId/invitations', verifyFirebaseToken, async (req, res) => {
  const { schoolId } = req.params;
  const { email, role = 'teacher', targetName = '' } = req.body;
  const callerUid = req.user.uid;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const isAdmin = await checkSchoolAdmin(schoolId, callerUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only school administrators can issue invitations' });
  }

  const schoolDoc = await db.collection('schools').doc(schoolId).get();
  if (!schoolDoc.exists) {
    return res.status(404).json({ error: 'School not found' });
  }
  const schoolName = schoolDoc.data().name || 'Unknown School';

  const normalizedEmail = email.trim().toLowerCase();
  const invitationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const token = crypto.randomUUID();
  const now = FieldValue.serverTimestamp();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    const inviteData = {
      id: invitationId,
      schoolId,
      schoolName,
      email: normalizedEmail,
      targetName: targetName.trim(),
      role: role.trim().toLowerCase(),
      invitedByUid: callerUid,
      invitedByEmail: req.user.email,
      status: 'pending',
      createdAt: now,
      expiresAt: expiresAt.toISOString(),
      token
    };

    const batch = db.batch();

    // Store under school
    const schoolInviteRef = db.collection('schools').doc(schoolId).collection('invitations').doc(invitationId);
    batch.set(schoolInviteRef, inviteData);

    // Store in global invitations index for fast discovery by recipient email
    const emailKey = `${encodeURIComponent(normalizedEmail)}_${schoolId}`;
    const emailInviteRef = db.collection('pendingInvitations').doc(emailKey);
    batch.set(emailInviteRef, inviteData);

    await batch.commit();

    return res.status(201).json({
      success: true,
      invitation: {
        id: invitationId,
        schoolId,
        schoolName,
        email: normalizedEmail,
        role: inviteData.role,
        expiresAt: inviteData.expiresAt
      }
    });
  } catch (err) {
    console.error('Error creating invitation:', err);
    return res.status(500).json({ error: 'Failed to create invitation: ' + err.message });
  }
});

// 2. Get pending invitations for authenticated user
router.get('/my-invitations', verifyFirebaseToken, async (req, res) => {
  const userEmail = (req.user.email || '').toLowerCase().trim();
  if (!userEmail) {
    return res.json({ invitations: [] });
  }

  try {
    const snap = await db.collection('pendingInvitations')
      .where('email', '==', userEmail)
      .where('status', '==', 'pending')
      .get();

    const invitations = [];
    const now = new Date();

    snap.forEach(doc => {
      const data = doc.data();
      if (new Date(data.expiresAt) > now) {
        invitations.push({
          id: data.id,
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          role: data.role,
          invitedByEmail: data.invitedByEmail,
          expiresAt: data.expiresAt
        });
      }
    });

    return res.json({ invitations });
  } catch (err) {
    console.error('Error fetching user invitations:', err);
    return res.status(500).json({ error: 'Failed to fetch pending invitations' });
  }
});

// 3. Accept an invitation
router.post('/accept', verifyFirebaseToken, async (req, res) => {
  const { schoolId, invitationId } = req.body;
  const uid = req.user.uid;
  const userEmail = (req.user.email || '').toLowerCase().trim();
  const userName = req.user.name || userEmail.split('@')[0];

  if (!schoolId || !invitationId) {
    return res.status(400).json({ error: 'schoolId and invitationId are required' });
  }

  try {
    const inviteRef = db.collection('schools').doc(schoolId).collection('invitations').doc(invitationId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const inviteData = inviteSnap.data();

    if (inviteData.status !== 'pending') {
      return res.status(400).json({ error: `Invitation is already ${inviteData.status}` });
    }

    if (new Date(inviteData.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    if (inviteData.email !== userEmail) {
      return res.status(403).json({ error: 'This invitation was addressed to a different email address' });
    }

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();

    // 1. Mark invitation accepted in school
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUid: uid
    });

    // 2. Remove / update from pendingInvitations index
    const emailKey = `${encodeURIComponent(userEmail)}_${schoolId}`;
    const emailInviteRef = db.collection('pendingInvitations').doc(emailKey);
    batch.delete(emailInviteRef);

    // 3. Add user as member to the school
    const memberRef = db.collection('schools').doc(schoolId).collection('members').doc(uid);
    batch.set(memberRef, {
      uid,
      email: userEmail,
      name: inviteData.targetName || userName,
      role: inviteData.role,
      status: 'active',
      joinedAt: now
    });

    // 4. Add school link in user profile
    const userRef = db.collection('users').doc(uid);
    const linkRef = userRef.collection('schoolLinks').doc(schoolId);
    batch.set(linkRef, {
      schoolId,
      schoolName: inviteData.schoolName,
      role: inviteData.role,
      status: 'active',
      joinedAt: now
    });

    // 5. Default school preferences for this user
    const prefRef = userRef.collection('schoolPreferences').doc(schoolId);
    batch.set(prefRef, {
      schoolId,
      lessonInterval: 15,
      rememberLastUsed: false,
      updatedAt: now
    }, { merge: true });

    await batch.commit();

    return res.json({
      success: true,
      schoolId,
      schoolName: inviteData.schoolName,
      role: inviteData.role
    });
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return res.status(500).json({ error: 'Failed to accept invitation: ' + err.message });
  }
});

// 4. Decline an invitation
router.post('/decline', verifyFirebaseToken, async (req, res) => {
  const { schoolId, invitationId } = req.body;
  const userEmail = (req.user.email || '').toLowerCase().trim();

  if (!schoolId || !invitationId) {
    return res.status(400).json({ error: 'schoolId and invitationId are required' });
  }

  try {
    const inviteRef = db.collection('schools').doc(schoolId).collection('invitations').doc(invitationId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const inviteData = inviteSnap.data();
    if (inviteData.email !== userEmail) {
      return res.status(403).json({ error: 'Unauthorized to decline this invitation' });
    }

    const batch = db.batch();
    batch.update(inviteRef, {
      status: 'declined',
      declinedAt: FieldValue.serverTimestamp()
    });

    const emailKey = `${encodeURIComponent(userEmail)}_${schoolId}`;
    batch.delete(db.collection('pendingInvitations').doc(emailKey));

    await batch.commit();
    return res.json({ success: true, message: 'Invitation declined' });
  } catch (err) {
    console.error('Error declining invitation:', err);
    return res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// 5. Resend invitation (Admin only)
router.post('/schools/:schoolId/invitations/:invitationId/resend', verifyFirebaseToken, async (req, res) => {
  const { schoolId, invitationId } = req.params;
  const callerUid = req.user.uid;

  const isAdmin = await checkSchoolAdmin(schoolId, callerUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only school administrators can resend invitations' });
  }

  try {
    const inviteRef = db.collection('schools').doc(schoolId).collection('invitations').doc(invitationId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const inviteData = inviteSnap.data();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const token = crypto.randomUUID();

    const updates = {
      expiresAt,
      token,
      status: 'pending',
      updatedAt: FieldValue.serverTimestamp()
    };

    await inviteRef.update(updates);

    const emailKey = `${encodeURIComponent(inviteData.email)}_${schoolId}`;
    await db.collection('pendingInvitations').doc(emailKey).set({
      ...inviteData,
      ...updates
    }, { merge: true });

    return res.json({ success: true, message: 'Invitation refreshed', expiresAt });
  } catch (err) {
    console.error('Error resending invitation:', err);
    return res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// 6. Revoke invitation (Admin only)
router.post('/schools/:schoolId/invitations/:invitationId/revoke', verifyFirebaseToken, async (req, res) => {
  const { schoolId, invitationId } = req.params;
  const callerUid = req.user.uid;

  const isAdmin = await checkSchoolAdmin(schoolId, callerUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only school administrators can revoke invitations' });
  }

  try {
    const inviteRef = db.collection('schools').doc(schoolId).collection('invitations').doc(invitationId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const inviteData = inviteSnap.data();
    const batch = db.batch();

    batch.update(inviteRef, {
      status: 'revoked',
      revokedAt: FieldValue.serverTimestamp()
    });

    const emailKey = `${encodeURIComponent(inviteData.email)}_${schoolId}`;
    batch.delete(db.collection('pendingInvitations').doc(emailKey));

    await batch.commit();

    return res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    console.error('Error revending invitation:', err);
    return res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

export default router;

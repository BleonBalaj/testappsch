import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { MOODS, localDateKey } from '../features/moods';

const MoodContext = createContext();

export const MoodProvider = ({ children }) => {
  const { currentUser, activeSchoolId } = useAuth();
  const [moodHistory, setMoodHistory] = useState(() => {
    try {
      if (currentUser?.uid) {
        const cached = localStorage.getItem(`lumi-cached-moods-${currentUser.uid}`);
        return cached ? JSON.parse(cached) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Load initial cache for this user
    try {
      const cached = localStorage.getItem(`lumi-cached-moods-${currentUser.uid}`);
      if (cached) {
        setMoodHistory(JSON.parse(cached));
      }
    } catch { /* Ignore an invalid local cache and use the cloud snapshot. */ }

    const moodsCol = collection(db, 'users', currentUser.uid, 'moods');
    const unsubscribe = onSnapshot(moodsCol, (snapshot) => {
      const moods = [];
      snapshot.forEach(docSnap => {
        moods.push({ id: docSnap.id, ...docSnap.data() });
      });
      moods.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setMoodHistory(moods);
      try {
        localStorage.setItem(`lumi-cached-moods-${currentUser.uid}`, JSON.stringify(moods));
      } catch { /* Ignore an invalid local cache and use the cloud snapshot. */ }
    }, (err) => {
      console.warn('Notice listening to moods:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const addMoodEntry = async (mood, note = '') => {
    // Only a mood the person picked is recorded; nothing defaults to "happy".
    if (!MOODS.includes(mood)) return;
    const cleanMood = mood;
    const cleanNote = typeof note === 'string' ? note.trim() : (note ? String(note).trim() : '');
    // The person's own calendar day, not UTC (which is a day behind after midnight in Kosovo).
    const today = localDateKey();
    const newEntry = { 
      id: today, 
      date: today, 
      mood: cleanMood, 
      note: cleanNote 
    };

    // Optimistically update local state
    setMoodHistory(prev => {
      const filtered = prev.filter(item => item.date !== today);
      const updated = [newEntry, ...filtered];
      if (currentUser?.uid) {
        try {
          localStorage.setItem(`lumi-cached-moods-${currentUser.uid}`, JSON.stringify(updated));
        } catch { /* Storage is optional; Firestore remains the source of truth. */ }
      }
      return updated;
    });

    // Persist to Firestore Cloud in real-time
    if (currentUser?.uid) {
      try {
        const moodDocRef = doc(db, 'users', currentUser.uid, 'moods', today);
        await setDoc(moodDocRef, {
          id: today,
          date: today,
          mood: cleanMood,
          note: cleanNote,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // If school is active, record in school mood entries collection
        if (activeSchoolId) {
          const schoolMoodRef = doc(db, 'schools', activeSchoolId, 'moodEntries', `${currentUser.uid}_${today}`);
          await setDoc(schoolMoodRef, {
            id: `${currentUser.uid}_${today}`,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'School Member',
            mood: cleanMood,
            date: today,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.error('Error saving mood to Firestore:', err);
      }
    }
  };

  const getTodayMood = () => {
    const today = localDateKey();
    return moodHistory.find(item => item.date === today);
  };

  return (
    <MoodContext.Provider value={{ moodHistory, addMoodEntry, getTodayMood }}>
      {children}
    </MoodContext.Provider>
  );
};

export const useMood = () => {
  const context = useContext(MoodContext);
  if (!context) throw new Error('useMood must be used within a MoodProvider');
  return context;
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const MoodContext = createContext();

export const MoodProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [moodHistory, setMoodHistory] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const moodsCol = collection(db, 'users', currentUser.uid, 'moods');
    const unsubscribe = onSnapshot(moodsCol, (snapshot) => {
      const moods = [];
      snapshot.forEach(docSnap => {
        moods.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMoodHistory(moods);
    }, (err) => {
      console.warn('Notice listening to moods:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const addMoodEntry = async (mood, note) => {
    const today = new Date().toISOString().split('T')[0];
    const newEntry = { id: today, date: today, mood, note };

    setMoodHistory(prev => {
      const filtered = prev.filter(item => item.date !== today);
      return [newEntry, ...filtered];
    });

    if (currentUser?.uid) {
      try {
        const moodDocRef = doc(db, 'users', currentUser.uid, 'moods', today);
        await setDoc(moodDocRef, {
          ...newEntry,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('Error saving mood to Firestore:', err.message);
      }
    }
  };

  const getTodayMood = () => {
    const today = new Date().toISOString().split('T')[0];
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

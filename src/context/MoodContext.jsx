import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { MOODS, localDateKey } from '../features/moods';

const MoodContext = createContext();

export const MoodProvider = ({ children }) => {
  const { currentUser, activeSchoolId, activeSchool, currentRole } = useAuth();
  const [saving,setSaving]=useState(false),[error,setError]=useState(null);
  const running=useRef(false),account=useRef(currentUser?.uid);account.current=currentUser?.uid;
  const [moodHistory, setMoodHistory] = useState(() => {
    try {
      if (currentUser?.uid) {
        const cached = localStorage.getItem(`lumi-cached-moods-${currentUser.uid}`);
        const parsed=cached?JSON.parse(cached):[];
        return Array.isArray(parsed)?parsed.filter(entry=>entry&&MOODS.includes(entry.mood)&&typeof entry.date==='string'):[];
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUser?.uid) {setMoodHistory([]);return;}

    // Load initial cache for this user
    try {
      const cached = localStorage.getItem(`lumi-cached-moods-${currentUser.uid}`);
      if (cached) {
        const parsed=JSON.parse(cached);
        setMoodHistory(Array.isArray(parsed)?parsed.filter(entry=>entry&&MOODS.includes(entry.mood)&&typeof entry.date==='string'):[]);
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
      setMoodHistory([]);setError(err);
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

    if(!currentUser?.uid||running.current)return false;
    const uid=currentUser.uid;
    running.current=true;setSaving(true);setError(null);
    try {
      const batch=writeBatch(db);
      batch.set(doc(db,'users',uid,'moods',today),{...newEntry,updatedAt:serverTimestamp()},{merge:true});
      const audience=currentRole==='student'?'student':'teacher';
      if(activeSchoolId&&(currentRole==='admin'||activeSchool?.rolePermissions?.[audience]?.['mood-insights']!==false))batch.set(doc(db,'schools',activeSchoolId,'moodEntries',uid+'_'+today),{id:uid+'_'+today,userId:uid,userName:currentUser.displayName||'School Member',mood:cleanMood,date:today,updatedAt:serverTimestamp()},{merge:true});
      await batch.commit();
      if(account.current===uid)setMoodHistory(previous=>{const next=[newEntry,...previous.filter(entry=>entry.date!==today)];try{localStorage.setItem('lumi-cached-moods-'+uid,JSON.stringify(next));}catch{/* Optional cache. */}return next;});
      return true;
    }catch(error){if(account.current===uid)setError(error);return false;}
    finally{running.current=false;if(account.current===uid)setSaving(false);}

  };

  const getTodayMood = () => {
    const today = localDateKey();
    return moodHistory.find(item => item.date === today);
  };

  return (
    <MoodContext.Provider value={{ moodHistory, addMoodEntry, getTodayMood, saving, error }}>
      {children}
    </MoodContext.Provider>
  );
};

export const useMood = () => {
  const context = useContext(MoodContext);
  if (!context) throw new Error('useMood must be used within a MoodProvider');
  return context;
};

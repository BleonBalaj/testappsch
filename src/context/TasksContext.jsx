import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query,
  where,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import {verifiedSnapshot} from '../features/liveResource';

const TasksContext = createContext(null);

export const TasksProvider = ({ children }) => {
  const { activeSchoolId, currentUser, currentRole, roleReady } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState(null);

  useEffect(() => {
    if (!activeSchoolId || !currentUser?.uid || !roleReady) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTasks([]);setError(null);let active=true;
    const source = collection(db, 'schools', activeSchoolId, 'tasks');
    const tasksCol = currentRole==='student'?query(source,where('role','==','student')):source;
    const unsubscribe = onSnapshot(tasksCol,{includeMetadataChanges:true}, (snapshot) => {
      if(!active||!verifiedSnapshot(snapshot))return;
      const loadedTasks = [];
      snapshot.forEach((docSnap) => {
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTasks(loadedTasks);
      setLoading(false);
    }, (err) => {
      if(!active)return;
      console.warn('Notice listening to tasks:', err.message);
      setTasks([]);setError(err);
      setLoading(false);
    });

    return () => {active=false;unsubscribe();};
  }, [activeSchoolId, currentUser?.uid,currentRole,roleReady]);

  const perform=useCallback(async work=>{setError(null);try{if(!activeSchoolId||!currentUser?.uid)throw new Error('Select a school and sign in first.');await work();return true;}catch(error){setError(error);return false;}},[activeSchoolId,currentUser?.uid]);

  const addTask = useCallback(async (task) => {
    const taskId = task.id || `tsk_${crypto.randomUUID()}`;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(taskId));
    return perform(()=>setDoc(taskDocRef, {
      ...task,
      id: taskId,
      createdAt: serverTimestamp(),
      createdByUid: currentUser?.uid,
      role: currentRole==='student'?'student':(task.role||currentRole)
    }));
  }, [activeSchoolId, currentUser?.uid,currentRole,perform]);

  const updateTask = useCallback(async (id, changes) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    return perform(()=>updateDoc(taskDocRef, { ...changes, updatedAt: serverTimestamp() }));
  }, [activeSchoolId,perform]);

  const deleteTask = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    return perform(()=>deleteDoc(taskDocRef));
  }, [activeSchoolId,perform]);

  const moveTask = useCallback(async (id, status) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    return perform(()=>updateDoc(taskDocRef, { status, updatedAt: serverTimestamp() }));
  }, [activeSchoolId,perform]);

  return (
    <TasksContext.Provider value={{ tasks, loading, error, addTask, updateTask, deleteTask, moveTask }}>
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
};

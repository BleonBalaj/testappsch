import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const TasksContext = createContext(null);

export const TasksProvider = ({ children }) => {
  const { activeSchoolId, currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSchoolId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksCol = collection(db, 'schools', activeSchoolId, 'tasks');
    const unsubscribe = onSnapshot(tasksCol, (snapshot) => {
      const loadedTasks = [];
      snapshot.forEach((docSnap) => {
        loadedTasks.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTasks(loadedTasks);
      setLoading(false);
    }, (err) => {
      console.warn('Notice listening to tasks:', err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeSchoolId, currentUser?.uid]);

  const addTask = useCallback(async (task) => {
    if (!activeSchoolId) return;
    const taskId = task.id || `tsk_${Date.now()}`;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(taskId));
    await setDoc(taskDocRef, {
      ...task,
      id: taskId,
      createdAt: serverTimestamp(),
      createdByUid: currentUser?.uid || 'user'
    });
  }, [activeSchoolId, currentUser?.uid]);

  const updateTask = useCallback(async (id, changes) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    await updateDoc(taskDocRef, { ...changes, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  const deleteTask = useCallback(async (id) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    await deleteDoc(taskDocRef);
  }, [activeSchoolId]);

  const moveTask = useCallback(async (id, status) => {
    if (!activeSchoolId) return;
    const taskDocRef = doc(db, 'schools', activeSchoolId, 'tasks', String(id));
    await updateDoc(taskDocRef, { status, updatedAt: serverTimestamp() });
  }, [activeSchoolId]);

  return (
    <TasksContext.Provider value={{ tasks, loading, addTask, updateTask, deleteTask, moveTask }}>
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
};

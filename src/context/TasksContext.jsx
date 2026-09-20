import React, { createContext, useContext, useState, useCallback } from 'react';

const INITIAL_TASKS = [
  { id: 1, content: 'Grade Math tests', status: 'todo',       priority: 'high',   category: 'Grading',    due: '2026-03-25', notes: 'Focus on problem sets 4–6', role: 'staff' },
  { id: 2, content: 'Prepare Science lab', status: 'todo',    priority: 'medium', category: 'Prep',       due: '2026-03-26', notes: '', role: 'staff' },
  { id: 3, content: 'Parent meeting',      status: 'inprogress', priority: 'high', category: 'Admin',    due: '2026-03-24', notes: 'Discuss semester progress', role: 'staff' },
  { id: 4, content: 'Update syllabus',     status: 'done',    priority: 'low',    category: 'Admin',      due: '2026-03-20', notes: '', role: 'staff' },
  { id: 5, content: 'Review attendance records', status: 'todo', priority: 'medium', category: 'Admin',  due: '2026-03-28', notes: '', role: 'staff' },
  { id: 6, content: 'Prepare quiz for Chapter 5', status: 'todo', priority: 'high',  category: 'Prep',   due: '2026-03-27', notes: '', role: 'staff' },
  // Student Personal Tasks
  { id: 101, content: 'Physics Problem Set #4 (Kinematics)', status: 'todo', priority: 'high', category: 'Homework', due: '2026-03-25', notes: 'Problems 12-25 on page 84', role: 'student' },
  { id: 102, content: 'English Literature Essay Draft', status: 'inprogress', priority: 'high', category: 'Homework', due: '2026-03-26', notes: 'Comparative analysis of 2 poems', role: 'student' },
  { id: 103, content: 'Biology Lab Report Prep', status: 'todo', priority: 'medium', category: 'Study', due: '2026-03-27', notes: 'Print microscope slides appendix', role: 'student' },
  { id: 104, content: 'Review Calculus derivatives formulas', status: 'done', priority: 'medium', category: 'Study', due: '2026-03-21', notes: 'Completed summary sheet', role: 'student' },
  { id: 105, content: 'Science Fair Project display board', status: 'todo', priority: 'high', category: 'Project', due: '2026-03-29', notes: 'Gather acrylic paint and printed charts', role: 'student' },
];

const TasksContext = createContext(null);

export const TasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const addTask = useCallback((task) => {
    setTasks(prev => [...prev, { ...task, id: Date.now() }]);
  }, []);

  const updateTask = useCallback((id, changes) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const moveTask = useCallback((id, status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  return (
    <TasksContext.Provider value={{ tasks, addTask, updateTask, deleteTask, moveTask }}>
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
};

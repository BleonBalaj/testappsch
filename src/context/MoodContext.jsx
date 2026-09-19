import React, { createContext, useContext, useState, useEffect } from 'react';

const MoodContext = createContext();

export const MoodProvider = ({ children }) => {
  const [moodHistory, setMoodHistory] = useState(() => {
    const saved = localStorage.getItem('lumi-mood-history');
    return saved ? JSON.parse(saved) : [
      { id: 1, date: '2026-05-01', mood: 'happy', note: 'Great day at school!' },
      { id: 2, date: '2026-05-02', mood: 'neutral', note: 'A bit tired today.' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('lumi-mood-history', JSON.stringify(moodHistory));
  }, [moodHistory]);

  const addMoodEntry = (mood, note) => {
    const today = new Date().toISOString().split('T')[0];
    // Replace today's entry if it exists, or add new
    setMoodHistory(prev => {
      const filtered = prev.filter(item => item.date !== today);
      return [{ id: Date.now(), date: today, mood, note }, ...filtered];
    });
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

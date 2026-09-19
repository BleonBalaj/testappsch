import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserPlus, BookOpen, CalendarPlus, UserCheck, Megaphone, Check } from 'lucide-react';
import './QuickAction.css';

const QuickAction = ({ addNotification, onNavigate, userRole = 'admin', currentPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  if (currentPath === 'messages') {
    return null;
  }

  const actions = [
    { id: 'student', icon: UserPlus, label: 'Add Student', color: 'hsl(var(--primary))', target: 'students' },
    { 
      id: 'staff', 
      icon: UserCheck, 
      label: isAdmin ? 'Add Staff Member' : 'Staff Directory', 
      color: 'hsl(var(--accent))', 
      target: 'staff' 
    },
    { id: 'class', icon: BookOpen, label: 'Course Catalog', color: 'hsl(var(--chart-2))', target: 'classes' },
    { id: 'event', icon: CalendarPlus, label: 'School Calendar', color: 'hsl(var(--chart-1))', target: 'events' },
  ];

  const handleAction = (action) => {
    setIsOpen(false);
    if (onNavigate && action.target) {
      onNavigate(action.target);
    }
  };

  return (
    <div className="quick-action-container">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              className="quick-action-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <div className="action-menu">
              {actions.map((action, i) => (
                <motion.button
                  key={action.id}
                  className="action-btn glass bouncy"
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { delay: i * 0.05 } }}
                  transition={{ delay: (actions.length - i) * 0.05 }}
                  onClick={() => handleAction(action)}
                >
                  <span className="action-label">{action.label}</span>
                  <div className="action-icon" style={{ backgroundColor: action.color, color: 'white' }}>
                    <action.icon size={19} />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      <motion.button 
        className={`fab-btn bouncy ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Quick Actions"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Plus size={30} />
        </motion.div>
      </motion.button>
    </div>
  );
};

export default QuickAction;

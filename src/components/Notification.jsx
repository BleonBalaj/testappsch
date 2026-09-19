import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import './Notification.css';

const Notification = ({ id, type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle2 size={20} color="var(--mood-happy)" />,
    error: <AlertCircle size={20} color="var(--mood-sad)" />,
    info: <Info size={20} color="var(--primary)" />
  };

  return (
    <motion.div 
      className={`notification glass ${type}`}
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      layout
    >
      <div className="notification-icon">
        {icons[type] || icons.info}
      </div>
      <div className="notification-content">
        <p>{message}</p>
      </div>
      <button className="notification-close" onClick={() => onClose(id)}>
        <X size={16} />
      </button>
    </motion.div>
  );
};

const NotificationContainer = ({ notifications, removeNotification }) => {
  return (
    <div className="notification-container">
      <AnimatePresence>
        {notifications.map((n) => (
          <Notification 
            key={n.id} 
            {...n} 
            onClose={removeNotification} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationContainer;

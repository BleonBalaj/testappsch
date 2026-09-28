import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import NotFound from './NotFound';
import NotificationContainer from '../components/Notification';
import { isPlatformAdminEmail } from '../features/platformAdmin/access';
import { navigateTo } from '../features/platformAdmin/route';
import './PlatformAdminRoute.css';

// Loaded only for the platform admin, so nobody else downloads the dashboard.
const PlatformAdmin = lazy(() => import('./PlatformAdmin'));

function FullScreenLoader({ label }) {
  return (
    <div className="padm-loader" role="status">
      <Sparkles size={32} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
      <span>{label}</span>
    </div>
  );
}

/**
 * /admin: signed-out visitors get the normal sign-in screen (as on any path),
 * signed-in accounts other than the platform admin get "page not found".
 */
export default function PlatformAdminRoute({ view }) {
  const { currentUser, authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (localStorage.getItem('lumi-theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const addNotification = (type, message) => setNotifications(prev => [...prev, { id: Date.now(), type, message }]);
  const removeNotification = id => setNotifications(prev => prev.filter(item => item.id !== id));
  const goHome = () => navigateTo('/');

  if (authLoading) return <FullScreenLoader label="Checking your session..." />;

  if (!currentUser) {
    return (
      <div className="login-root-container">
        <Login onLogin={() => {}} onNavigate={() => {}} addNotification={addNotification} />
        <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
      </div>
    );
  }

  if (!view || !isPlatformAdminEmail(currentUser.email)) return <NotFound onGoHome={goHome} />;

  return (
    <Suspense fallback={<FullScreenLoader label="Opening platform admin..." />}>
      <PlatformAdmin view={view} currentUser={currentUser} onNavigate={navigateTo} onGoHome={goHome} />
    </Suspense>
  );
}

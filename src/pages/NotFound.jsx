import React from 'react';
import { Compass, Home } from 'lucide-react';
import StarryBackground from '../components/StarryBackground';
import './NotFound.css';

export default function NotFound({ onGoHome }) {
  return (
    <div className="not-found-page">
      <StarryBackground />
      <main className="not-found-card" aria-labelledby="not-found-title">
        <div className="not-found-icon" aria-hidden="true">
          <Compass size={30} />
        </div>
        <p className="not-found-code">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="not-found-text">
          The page you are looking for does not exist or has moved.
        </p>
        <button type="button" className="btn-primary" onClick={onGoHome}>
          <Home size={16} />
          Go to dashboard
        </button>
      </main>
    </div>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import './features/theme/nature.css';
import './components/theme/ThemePicker.css';
import { applyTheme } from './features/theme/themeStore';

applyTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

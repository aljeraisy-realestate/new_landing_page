import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import { applyPreferences, initialLanguage, initialTheme } from './preferences.js';
import './styles.css';
import './pages.css';
import './admin.css';

applyPreferences(initialLanguage(), initialTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode><AdminApp /></StrictMode>,
);

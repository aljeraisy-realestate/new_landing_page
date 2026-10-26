import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyPreferences, initialLanguage, initialTheme } from './preferences.js';
import './styles.css';
import './pages.css';
import './mobile-preview.css';
import './security.css';

applyPreferences(initialLanguage(), initialTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

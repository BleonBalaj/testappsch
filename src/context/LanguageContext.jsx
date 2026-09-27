import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { useAuth } from './AuthContext';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const { globalPreferences, updateGlobalPreferences } = useAuth() || {};

  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem('lumi-language') || localStorage.getItem('lumi-lesson-language');
      if (stored === 'sq' || stored === 'en') return stored;
    } catch {}
    return 'en';
  });

  // Sync from AuthContext globalPreferences if loaded
  useEffect(() => {
    if (globalPreferences?.language && (globalPreferences.language === 'en' || globalPreferences.language === 'sq')) {
      if (globalPreferences.language !== language) {
        setLanguageState(globalPreferences.language);
        try {
          localStorage.setItem('lumi-language', globalPreferences.language);
          localStorage.setItem('lumi-lesson-language', globalPreferences.language);
        } catch {}
      }
    }
  }, [globalPreferences?.language]);

  const changeLanguage = useCallback(async (newLang) => {
    const lang = newLang === 'sq' ? 'sq' : 'en';
    setLanguageState(lang);
    try {
      localStorage.setItem('lumi-language', lang);
      localStorage.setItem('lumi-lesson-language', lang);
    } catch {}

    // Dispatch global custom event for legacy / external listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
    }

    if (updateGlobalPreferences) {
      try {
        await updateGlobalPreferences({ language: lang });
      } catch (err) {
        console.warn('Notice saving language preference to cloud:', err.message);
      }
    }
  }, [updateGlobalPreferences]);

  // Translation helper function
  const t = useCallback((key, fallback) => {
    const langDict = translations[language] || translations.en;
    if (langDict && langDict[key] !== undefined) {
      return langDict[key];
    }
    // Fallback to English dictionary
    if (translations.en && translations.en[key] !== undefined) {
      return translations.en[key];
    }
    return fallback !== undefined ? fallback : key;
  }, [language]);

  const value = {
    language,
    isAlbanian: language === 'sq',
    changeLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Safe fallback if used outside provider
    return {
      language: 'en',
      isAlbanian: false,
      changeLanguage: () => {},
      t: (key, fallback) => (translations.en?.[key] !== undefined ? translations.en[key] : (fallback || key))
    };
  }
  return context;
};

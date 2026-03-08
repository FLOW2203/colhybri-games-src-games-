// ---------------------------------------------------------------------------
// COLHYBRI GAMES — Locale context & hook
// ---------------------------------------------------------------------------

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { t as translate, SUPPORTED_LOCALES } from '../i18n/index';

const STORAGE_KEY = 'colhybri_locale';

const LocaleContext = createContext(null);

/**
 * Detect the best supported locale from the browser.
 * Maps e.g. 'fr-FR' → 'fr', 'en-US' → 'en', 'pt-BR' → 'pt'.
 * Falls back to 'fr' (primary app language).
 */
function detectBrowserLocale() {
  if (typeof navigator === 'undefined') return 'fr';

  const raw =
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    'fr';

  const lower = raw.toLowerCase();
  const prefix = lower.split('-')[0];

  if (SUPPORTED_LOCALES.includes(lower)) return lower;
  if (SUPPORTED_LOCALES.includes(prefix)) return prefix;

  return 'fr';
}

/**
 * Read persisted locale from localStorage (if available and valid).
 */
function getPersistedLocale() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return null;
}

/**
 * Persist locale choice to localStorage.
 */
function persistLocale(locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage full or unavailable — silent fail
  }
}

/**
 * LocaleProvider — wraps the app and provides locale state + t() helper.
 *
 * On mount:
 *  1. Checks localStorage for a previously saved locale.
 *  2. Falls back to auto-detecting from navigator.language.
 *  3. Defaults to 'fr'.
 *
 * Persists every locale change to localStorage.
 */
export function LocaleProvider({ children }) {
  const [locale, setLocaleRaw] = useState(() => {
    return getPersistedLocale() || detectBrowserLocale();
  });

  // Persist whenever locale changes
  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((newLocale) => {
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleRaw(newLocale);
    }
  }, []);

  const t = useCallback(
    (translationObj) => translate(translationObj, locale),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * useLocale() — returns { locale, setLocale, t }.
 *
 * - locale: current locale string (e.g. 'fr', 'en')
 * - setLocale(loc): switch to a supported locale
 * - t(obj): resolve a translation object to the current locale string
 *
 * Throws if used outside of <LocaleProvider>.
 */
export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a <LocaleProvider>');
  }
  return ctx;
}

export default useLocale;

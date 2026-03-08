import { useState, useEffect, useCallback } from 'react';

function getStoredValue(key, defaultValue) {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

export default function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => getStoredValue(key, defaultValue));

  const setStoredValue = useCallback(
    (newValue) => {
      setValue((prev) => {
        const resolved =
          typeof newValue === 'function' ? newValue(prev) : newValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage full or unavailable — state still updates in memory.
        }
        return resolved;
      });
    },
    [key],
  );

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === key) {
        setValue(
          event.newValue === null
            ? defaultValue
            : (() => {
                try {
                  return JSON.parse(event.newValue);
                } catch {
                  return defaultValue;
                }
              })(),
        );
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key, defaultValue]);

  return [value, setStoredValue];
}

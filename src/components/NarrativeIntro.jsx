import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS } from '../i18n/index';

export default function NarrativeIntro({ text, onComplete }) {
  const { t } = useLocale();
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (done) return;
    if (displayed.length >= text.length) {
      setDone(true);
      return;
    }
    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, 30);
    return () => clearTimeout(timeout);
  }, [displayed, text, done]);

  const handleTap = useCallback(() => {
    if (!done) {
      setDisplayed(text);
      setDone(true);
    } else {
      setExiting(true);
    }
  }, [done, text]);

  const handleExitComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={handleTap}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer bg-gradient-to-b from-[#0A0F1C] via-[#111827] to-[#0A0F1C]"
        >
          <div className="max-w-lg px-8">
            <p className="text-white/90 text-xl leading-relaxed font-serif italic text-center">
              {displayed}
              {!done && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block ml-0.5 w-0.5 h-5 bg-[#2EEAA3] align-middle"
                />
              )}
            </p>
          </div>

          <motion.p
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-12 text-white/40 text-sm"
          >
            {t(UI_STRINGS.tapToSkip)}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

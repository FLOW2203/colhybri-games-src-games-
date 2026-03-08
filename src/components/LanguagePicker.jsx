import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';

const LANGUAGES = [
  { code: 'fr', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'en', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'es', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'de', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'el', flag: '\u{1F1EC}\u{1F1F7}' },
  { code: 'zh', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'ja', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'hi', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'pt', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'ru', flag: '\u{1F1F7}\u{1F1FA}' },
];

export default function LanguagePicker() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
      {LANGUAGES.map(({ code, flag }) => {
        const isActive = locale === code;
        return (
          <motion.button
            key={code}
            whileTap={{ scale: 0.9 }}
            onClick={() => setLocale(code)}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all
              ${
                isActive
                  ? 'ring-2 ring-[#2EEAA3] bg-[#2EEAA3]/10 shadow-md shadow-[#2EEAA3]/20'
                  : 'bg-white/5 hover:bg-white/10'
              }
            `}
            aria-label={code}
          >
            {flag}
          </motion.button>
        );
      })}
    </div>
  );
}

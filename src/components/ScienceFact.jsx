import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS } from '../i18n/index';

export default function ScienceFact({ fact, source }) {
  const { t } = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 max-w-sm w-full"
    >
      <p className="text-[#2EEAA3] font-bold text-xs uppercase tracking-widest mb-3">
        {t(UI_STRINGS.didYouKnow)}
      </p>

      <p className="text-white/90 text-base leading-relaxed mb-3">{fact}</p>

      {source && (
        <p className="text-white/40 text-xs italic">— {source}</p>
      )}

      <button
        className="mt-4 flex items-center gap-1.5 text-white/40 hover:text-[#2EEAA3] transition-colors text-xs"
        onClick={() => {
          if (navigator.share) {
            navigator.share({ text: fact }).catch(() => {});
          }
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {t(UI_STRINGS.share)}
      </button>
    </motion.div>
  );
}

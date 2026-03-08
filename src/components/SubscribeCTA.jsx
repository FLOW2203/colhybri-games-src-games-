import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS } from '../i18n/index';

const REWARD_THRESHOLD = 500;

export default function SubscribeCTA({ points }) {
  const { t } = useLocale();
  const progress = Math.min((points / REWARD_THRESHOLD) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative bg-[#111827] border border-white/10 rounded-2xl p-6 max-w-sm w-full overflow-hidden"
    >
      {/* Subtle glow */}
      <motion.div
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#2EEAA3] blur-3xl pointer-events-none"
      />

      {/* Points display */}
      <div className="relative flex items-center gap-2 mb-4">
        <span className="text-3xl">💧</span>
        <span className="text-3xl font-bold text-white">{points}</span>
      </div>

      {/* Progress bar */}
      <div className="relative mb-2">
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-[#2EEAA3] rounded-full"
          />
        </div>
        <div className="flex justify-between text-white/30 text-xs mt-1">
          <span>0</span>
          <span>{REWARD_THRESHOLD}</span>
        </div>
      </div>

      {/* CTA text */}
      <p className="relative text-white/70 text-sm mb-4 leading-relaxed">
        {t(UI_STRINGS.subscribeCta)}
      </p>

      {/* Subscribe button */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full py-3 rounded-xl font-bold text-[#0A0F1C] bg-[#2EEAA3] hover:brightness-110 transition-all shadow-lg shadow-[#2EEAA3]/20"
      >
        {t(UI_STRINGS.subscribe)}
      </motion.button>
    </motion.div>
  );
}

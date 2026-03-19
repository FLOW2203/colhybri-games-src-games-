// ---------------------------------------------------------------------------
// COLHYBRI GAMES — Bottom navigation bar (mobile-first)
// ---------------------------------------------------------------------------

import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS } from '../i18n/index';

const TABS = [
  { id: 'menu', icon: '🎮', labelKey: 'games' },
  { id: 'leaderboard', icon: '🏆', labelKey: 'leaderboard' },
  { id: 'profile', icon: '👤', labelKey: 'profile' },
];

export default function BottomNav({ active, onChange }) {
  const { t } = useLocale();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-lg border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[64px] min-h-[44px] ${
                isActive ? 'text-white' : 'text-white/40'
              }`}
              aria-label={t(UI_STRINGS[tab.labelKey])}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t(UI_STRINGS[tab.labelKey])}
              </span>
              {isActive && (
                <div className="w-4 h-0.5 bg-mint rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

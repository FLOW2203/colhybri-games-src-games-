// ---------------------------------------------------------------------------
// COLHYBRI GAMES — RewardsToast: golden ticket notification
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RewardsToast({ amount, visible, onDismiss }) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 3000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 24px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            boxShadow: '0 8px 32px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.3)',
            color: '#fff',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          onClick={onDismiss}
        >
          {/* Ticket icon */}
          <span style={{ fontSize: 22 }}>{'\u{1F3AB}'}</span>
          <span>+{amount} Golden Tickets</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

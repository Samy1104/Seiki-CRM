import { motion } from 'motion/react';
import { ShieldCheck, Zap } from 'lucide-react';

const TOGGLE_CLASSES =
  'text-sm font-medium flex items-center gap-2 px-3 md:pl-3 md:pr-3.5 py-3 md:py-1.5 transition-colors relative z-10';

interface ProspectionModeToggleProps {
  mode: 'manual' | 'auto';
  onChange: (mode: 'manual' | 'auto') => void;
}

export const ProspectionModeToggle: React.FC<ProspectionModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div className="relative flex w-fit items-center rounded-full bg-brand-bg-panel border border-brand-border">
      <button
        type="button"
        className={`${TOGGLE_CLASSES} ${mode === 'manual' ? 'text-white' : 'text-brand-text-secondary'}`}
        onClick={() => onChange('manual')}
      >
        <ShieldCheck className="relative z-10" size={14} />
        <span className="relative z-10">Vérification humaine</span>
      </button>
      <button
        type="button"
        className={`${TOGGLE_CLASSES} ${mode === 'auto' ? 'text-white' : 'text-brand-text-secondary'}`}
        onClick={() => onChange('auto')}
      >
        <Zap className="relative z-10" size={14} />
        <span className="relative z-10">Automatique</span>
      </button>
      <div className={`absolute inset-0 z-0 flex ${mode === 'auto' ? 'justify-end' : 'justify-start'}`}>
        <motion.span
          layout
          transition={{ type: 'spring', damping: 15, stiffness: 250 }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-purple to-brand-gold"
        />
      </div>
    </div>
  );
};

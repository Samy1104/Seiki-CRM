import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { SegmentedToggle } from './ui/SegmentedToggle';

interface ProspectionModeToggleProps {
  mode: 'manual' | 'auto';
  onChange: (mode: 'manual' | 'auto') => void;
}

export const ProspectionModeToggle: React.FC<ProspectionModeToggleProps> = ({ mode, onChange }) => {
  return (
    <SegmentedToggle
      value={mode}
      onChange={onChange}
      options={[
        {
          value: 'manual',
          label: 'Vérification humaine',
          icon: <ShieldCheck size={14} strokeWidth={2} />,
        },
        {
          value: 'auto',
          label: 'Automatique',
          icon: <Zap size={14} strokeWidth={2} />,
        },
      ]}
    />
  );
};

import React from 'react';
import { Maximize2, FileDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface CodirHeaderProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPrint: () => void;
}

export const CodirHeader: React.FC<CodirHeaderProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onPrint,
}) => {
  return (
    <div className="no-print mb-6 flex items-center justify-between">
      <div>
        <div className="font-display text-3xl font-bold text-ink">Dashboard CODIR</div>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onToggleFullscreen}>
          <Maximize2 size={12} />
          {isFullscreen ? 'Quitter Plein écran' : 'Plein écran'}
        </Button>
        <Button variant="primary" size="sm" onClick={onPrint}>
          <FileDown size={12} />
          Export PDF
        </Button>
      </div>
    </div>
  );
};

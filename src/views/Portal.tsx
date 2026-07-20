import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PortalProps {
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

export const Portal: React.FC<PortalProps> = ({ setActiveApp }) => {
  const { logout } = useAuth();
  const [hovered, setHovered] = useState<'crm' | 'contenu' | null>(null);

  return (
    <div className="h-screen w-full flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 pt-8">
        <span
          className="text-xs tracking-[0.25em] uppercase"
          style={{
            color: hovered === 'crm' ? '#f2ede4' : hovered === 'contenu' ? '#0d0d0d' : '#888880',
            transition: 'color 0.5s ease',
          }}
        >
          Bienvenue
        </span>
        <div className="flex items-center gap-6">
          <button
            onClick={logout}
            className="cursor-pointer bg-transparent border-0 p-0 text-xs tracking-[0.25em] uppercase transition-colors duration-300"
            style={{
              fontFamily: "'Inter', sans-serif",
              color: hovered === 'crm' ? '#f2ede4' : hovered === 'contenu' ? '#0d0d0d' : '#888880',
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Split panels */}
      <div className="flex flex-1 flex-col md:flex-row relative">
        {/* CRM — dark */}
        <button
          className="group relative flex-1 flex flex-col items-center justify-center overflow-hidden cursor-pointer border-none outline-none"
          style={{
            background: '#0d0d0d',
            transition: 'flex 0.6s cubic-bezier(0.76, 0, 0.24, 1)',
            flex: hovered === 'crm' ? '1.45' : hovered === 'contenu' ? '0.55' : '1',
          }}
          onMouseEnter={() => setHovered('crm')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setActiveApp('crm')}
          aria-label="Accéder au CRM"
        >
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px',
            }}
          />

          {/* Accent line */}
          <div
            className="absolute top-0 left-0 h-0.5 transition-all duration-700 ease-out"
            style={{
              width: hovered === 'crm' ? '100%' : '0%',
              background: '#c8b89a',
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
            <span
              className="block text-xs tracking-[0.3em] uppercase mb-2"
              style={{ fontFamily: "'Inter', sans-serif", color: '#c8b89a', opacity: hovered === 'crm' ? 1 : 0.5, transition: 'opacity 0.4s' }}
            >
              01
            </span>
            <h2
              className="leading-none select-none"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                fontSize: 'clamp(4rem, 10vw, 9rem)',
                color: '#f2ede4',
                letterSpacing: '-0.02em',
                transform: hovered === 'crm' ? 'translateY(-6px)' : 'translateY(0)',
                transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              CRM
            </h2>
            <p
              className="text-xs tracking-[0.25em] uppercase"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: '#c8b89a',
                opacity: hovered === 'crm' ? 1 : 0,
                transform: hovered === 'crm' ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s',
              }}
            >
              CRM interne à Seiki
            </p>
          </div>

          {/* Arrow */}
          <div
            className="absolute bottom-10 right-10 flex items-center gap-2"
            style={{
              fontFamily: "'Inter', sans-serif",
              color: '#c8b89a',
              opacity: hovered === 'crm' ? 1 : 0,
              transform: hovered === 'crm' ? 'translateX(0)' : 'translateX(-12px)',
              transition: 'opacity 0.35s ease 0.15s, transform 0.35s ease 0.15s',
            }}
          >
            <span className="text-xs tracking-[0.2em] uppercase">Entrer</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </div>
        </button>

        {/* Divider */}
        <div
          className="hidden md:block absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            left: hovered === 'crm' ? '59.09%' : hovered === 'contenu' ? '35.35%' : '50%',
            width: '1px',
            background: 'rgba(200, 184, 154, 0.2)',
            transition: 'left 0.6s cubic-bezier(0.76, 0, 0.24, 1)',
          }}
        />

        {/* CONTENU — cream */}
        <button
          className="group relative flex-1 flex flex-col items-center justify-center overflow-hidden cursor-pointer border-none outline-none"
          style={{
            background: '#f2ede4',
            transition: 'flex 0.6s cubic-bezier(0.76, 0, 0.24, 1)',
            flex: hovered === 'contenu' ? '1.45' : hovered === 'crm' ? '0.55' : '1',
          }}
          onMouseEnter={() => setHovered('contenu')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setActiveApp('contenu')}
          aria-label="Accéder au Contenu"
        >
          {/* Accent line */}
          <div
            className="absolute top-0 right-0 h-0.5 transition-all duration-700 ease-out"
            style={{
              width: hovered === 'contenu' ? '100%' : '0%',
              background: '#0d0d0d',
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
            <span
              className="block text-xs tracking-[0.3em] uppercase mb-2"
              style={{ fontFamily: "'Inter', sans-serif", color: '#888880', opacity: hovered === 'contenu' ? 1 : 0.5, transition: 'opacity 0.4s' }}
            >
              02
            </span>
            <h2
              className="leading-none select-none"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                fontSize: 'clamp(4rem, 10vw, 9rem)',
                color: '#0d0d0d',
                letterSpacing: '-0.02em',
                transform: hovered === 'contenu' ? 'translateY(-6px)' : 'translateY(0)',
                transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              CONTENU
            </h2>
            <p
              className="text-xs tracking-[0.25em] uppercase"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: '#0d0d0d',
                opacity: hovered === 'contenu' ? 1 : 0,
                transform: hovered === 'contenu' ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s',
              }}
            >
              Outil de gestion de contenu
            </p>
          </div>

          {/* Arrow */}
          <div
            className="absolute bottom-10 right-10 flex items-center gap-2"
            style={{
              fontFamily: "'Inter', sans-serif",
              color: '#0d0d0d',
              opacity: hovered === 'contenu' ? 1 : 0,
              transform: hovered === 'contenu' ? 'translateX(0)' : 'translateX(-12px)',
              transition: 'opacity 0.35s ease 0.15s, transform 0.35s ease 0.15s',
            }}
          >
            <span className="text-xs tracking-[0.2em] uppercase">Entrer</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </div>
        </button>
      </div>

      {/* Mobile stacked layout override */}
      <style>{`
        @media (max-width: 768px) {
          .portal-panel { flex: 1 !important; }
        }
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface PortalProps {
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

export const Portal: React.FC<PortalProps> = ({ setActiveApp }) => {
  const { logout } = useAuth();
  const crmCardRef = useRef<HTMLButtonElement>(null);
  const contenuCardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleTilt = (e: MouseEvent, card: HTMLButtonElement) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xPercent = (x / rect.width - 0.5) * 4;
      const yPercent = (y / rect.height - 0.5) * -4;
      card.style.transform = `perspective(1000px) rotateY(${xPercent}deg) rotateX(${yPercent}deg)`;
    };

    const handleReset = (card: HTMLButtonElement) => {
      card.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg)`;
    };

    const crmCard = crmCardRef.current;
    const contenuCard = contenuCardRef.current;

    const onCrmMouseMove = (e: MouseEvent) => crmCard && handleTilt(e, crmCard);
    const onCrmMouseLeave = () => crmCard && handleReset(crmCard);
    const onContenuMouseMove = (e: MouseEvent) => contenuCard && handleTilt(e, contenuCard);
    const onContenuMouseLeave = () => contenuCard && handleReset(contenuCard);

    if (crmCard) {
      crmCard.addEventListener('mousemove', onCrmMouseMove);
      crmCard.addEventListener('mouseleave', onCrmMouseLeave);
    }
    if (contenuCard) {
      contenuCard.addEventListener('mousemove', onContenuMouseMove);
      contenuCard.addEventListener('mouseleave', onContenuMouseLeave);
    }

    return () => {
      if (crmCard) {
        crmCard.removeEventListener('mousemove', onCrmMouseMove);
        crmCard.removeEventListener('mouseleave', onCrmMouseLeave);
      }
      if (contenuCard) {
        contenuCard.removeEventListener('mousemove', onContenuMouseMove);
        contenuCard.removeEventListener('mouseleave', onContenuMouseLeave);
      }
    };
  }, []);

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden font-ui text-ink"
      style={{
        backgroundColor: 'var(--color-base)',
        backgroundImage:
          'radial-gradient(at 50% 0%, var(--color-amber-glow) 0px, transparent 55%),' +
          'linear-gradient(to right, rgba(255,255,255,0.015) 1px, transparent 1px),' +
          'linear-gradient(to bottom, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
      }}
    >
      {/* Ambient subtle glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-glow blur-[120px]"></div>

      <style>{`
        .portal-card {
          transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), border-color 0.3s ease;
        }
        .crm-gradient {
          background: linear-gradient(135deg, var(--color-amber-soft) 0%, var(--color-surface) 100%);
        }
        .contenu-gradient {
          background: linear-gradient(135deg, rgba(100, 116, 139, 0.12) 0%, var(--color-surface) 100%);
        }
      `}</style>

      {/* TopNavBar */}
      <header className="fixed top-0 z-50 w-full border-b border-line bg-base/80 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-12 py-4">
          <div className="flex items-center gap-12">
            <img alt="Seiki Logo" className="h-8 w-auto object-contain" src="/grand_logo.png" />
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={logout}
              className="cursor-pointer bg-transparent border-0 p-0 font-mono text-sm uppercase tracking-widest text-ink-soft transition-colors duration-300 hover:text-amber"
            >
              se déconnecter
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content Canvas */}
      <main className="relative flex flex-grow flex-col items-center justify-center overflow-hidden pt-[72px]">
        <div className="z-10 flex h-[calc(100vh-180px)] w-full max-w-[1600px] flex-col gap-6 px-12 py-6 md:flex-row">
          {/* Card: CRM */}
          <button
            ref={crmCardRef}
            onClick={() => setActiveApp('crm')}
            className="portal-card crm-gradient group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border border-line text-left shadow-2xl hover:border-amber/40"
          >
            <div className="absolute inset-0 bg-amber-glow opacity-0 transition-opacity duration-700 group-hover:opacity-100"></div>
            <div className="relative flex h-full w-full flex-col items-start justify-center p-6 md:p-14">
              <div className="space-y-6">
                <h2 className="font-display text-6xl font-extrabold leading-[1.1] tracking-tighter text-ink md:text-8xl">CRM</h2>
                <p className="max-w-xl text-base leading-relaxed text-ink-soft md:text-xl">
                  CRM interne à Seiki
                </p>
                <div className="flex translate-y-4 items-center gap-3 pt-6 font-mono text-sm uppercase tracking-[0.1em] text-amber opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <span>ACCÉDER AU CRM</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </div>
              </div>
            </div>
          </button>

          {/* Card: CONTENU */}
          <button
            ref={contenuCardRef}
            onClick={() => setActiveApp('contenu')}
            className="portal-card contenu-gradient group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border border-line text-left shadow-2xl hover:border-chart-neutral/40"
          >
            <div className="absolute inset-0 bg-chart-neutral/10 opacity-0 transition-opacity duration-700 group-hover:opacity-100"></div>
            <div className="relative flex h-full w-full flex-col items-start justify-center p-6 md:p-14">
              <div className="space-y-6">
                <h2 className="font-display text-6xl font-extrabold leading-[1.1] tracking-tighter text-ink md:text-8xl">CONTENU</h2>
                <p className="max-w-xl text-base leading-relaxed text-ink-soft md:text-xl">
                  Outil de gestion et création de contenu
                </p>
                <div className="flex translate-y-4 items-center gap-3 pt-6 font-mono text-sm uppercase tracking-[0.1em] text-chart-neutral opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <span>ACCÉDER À L'OUTIL</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

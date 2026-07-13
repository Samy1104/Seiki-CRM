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
      className="flex flex-col min-h-screen relative overflow-hidden w-full"
      style={{
        backgroundColor: 'var(--bg-deep)',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(143, 55, 255, 0.08) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(247, 183, 0, 0.05) 0px, transparent 50%),
          linear-gradient(to right, rgba(255, 255, 255, 0.01) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)'
      }}
    >
      {/* Ambient subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--purple-glow)] blur-[120px] pointer-events-none rounded-full"></div>
      
      {/* Custom Styles */}
      <style>{`
        .crm-gradient {
          background: linear-gradient(135deg, rgba(143, 55, 255, 0.08) 0%, rgba(0, 0, 16, 0.95) 100%);
        }
        .contenu-gradient {
          background: linear-gradient(135deg, rgba(247, 183, 0, 0.05) 0%, rgba(0, 0, 16, 0.95) 100%);
        }
        .portal-card {
          transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), border-color 0.3s ease;
          background-color: var(--bg-panel);
          backdrop-filter: blur(20px);
        }
        .heading-font {
          font-family: 'Sora', var(--font-heading), system-ui, sans-serif;
          font-weight: 800;
        }
      `}</style>

      {/* TopNavBar */}
      <header className="fixed top-0 w-full bg-[#000010]/80 backdrop-blur-md z-50 border-b border-[rgba(255,255,255,0.05)]">
        <nav className="flex justify-between items-center px-12 py-4 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-12">
            <img alt="Seiki Logo" className="h-8 w-auto object-contain" src="/grand_logo.png" />
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={logout} 
              className="font-mono text-sm text-[var(--text-secondary)] hover:text-[var(--purple-light)] transition-colors duration-300 uppercase tracking-widest cursor-pointer"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
            >
              se déconnecter
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow pt-[72px] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="flex flex-col md:flex-row w-full h-[calc(100vh-180px)] px-12 gap-6 z-10 py-6 max-w-[1600px]">
          {/* Card: CRM */}
          <button 
            ref={crmCardRef}
            onClick={() => setActiveApp('crm')}
            className="portal-card crm-gradient relative flex-1 group overflow-hidden rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--purple)]/40 shadow-2xl text-left cursor-pointer"
          >
            <div className="absolute inset-0 bg-[var(--purple-glow)] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative h-full w-full flex flex-col items-start justify-center p-6 md:p-14">
              <div className="space-y-6">
                <h2 className="heading-font text-6xl md:text-8xl text-[var(--text-primary)] tracking-tighter leading-[1.1] font-bold">CRM</h2>
                <p className="text-base md:text-xl text-[var(--text-secondary)] max-w-xl leading-relaxed">
                  CRM interne à Seiki
                </p>
                <div className="flex items-center gap-3 pt-6 text-[var(--purple-light)] font-mono text-sm uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
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
            className="portal-card contenu-gradient relative flex-1 group overflow-hidden rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--gold)]/40 shadow-2xl text-left cursor-pointer"
          >
            <div className="absolute inset-0 bg-[var(--gold-glow)] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative h-full w-full flex flex-col items-start justify-center p-6 md:p-14">
              <div className="space-y-6">
                <h2 className="heading-font text-6xl md:text-8xl text-[var(--text-primary)] tracking-tighter leading-[1.1] font-bold">CONTENU</h2>
                <p className="text-base md:text-xl text-[var(--text-secondary)] max-w-xl leading-relaxed">
                  Outil de gestion et création de contenu
                </p>
                <div className="flex items-center gap-3 pt-6 text-[var(--gold)] font-mono text-sm uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
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

# Dual Access Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a gateway portal immediately after user login to route between the Seiki CRM and a placeholder Contenu tool.

**Architecture:** Add an `activeApp` state ('portal' | 'crm' | 'contenu') to `src/App.tsx`. Render the portal view (`src/views/Portal.tsx`) by default upon login. Allow switching to CRM or Contenu views, and support navigation back to the portal.

**Tech Stack:** React, Tailwind CSS, TypeScript, Supabase Auth.

## Global Constraints
- Do not affect existing CRM routing or views.
- Use styling matching screen `26fd9e46ea274b1a9f2e393bc0858d8b`.

---

### Task 1: Update index.html with Fonts and Icons

**Files:**
- Modify: [index.html](file:///d:/Stage/SEIKI/Projet/index.html)

**Interfaces:**
- Consumes: None
- Produces: Google Font stylesheets (Sora, Hanken Grotesk, JetBrains Mono) and Material Icons inside the head tag.

- [ ] **Step 1: Edit `index.html`**
  Add the font and icon stylesheet links to the `<head>` section:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&amp;family=Hanken+Grotesk:wght@400;500;600&amp;family=JetBrains+Mono:wght@500&amp;display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=block" rel="stylesheet"/>
  ```

- [ ] **Step 2: Commit**
  ```bash
  rtk git add index.html
  rtk git commit -m "feat: add Google fonts and Material icons to index.html"
  ```

---

### Task 2: Implement Portal View

**Files:**
- Create: [Portal.tsx](file:///d:/Stage/SEIKI/Projet/src/views/Portal.tsx)

**Interfaces:**
- Consumes: `useAuth` from `src/context/AuthContext`
- Produces: `<Portal setActiveApp={setActiveApp} />` view component

- [ ] **Step 1: Write Portal component**
  Create `src/views/Portal.tsx` with translated HTML and Tailwind styling. Include the mouse hover 3D tilt interaction logic:
  ```tsx
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
      <div className="flex flex-col min-h-screen bg-[#15111d] font-sans text-[#e8dff1] relative overflow-hidden w-full">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#c2c1ff]/5 blur-[120px] pointer-events-none rounded-full"></div>
        
        {/* Custom Styles */}
        <style>{`
          .seiki-gradient {
            background: linear-gradient(135deg, #1d0b3b 0%, #080312 100%);
          }
          .portal-card {
            transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), border-color 0.3s ease;
          }
        `}</style>

        {/* TopNavBar */}
        <header className="fixed top-0 w-full bg-[#15111d]/80 backdrop-blur-md z-50 border-b border-[#464556]/10">
          <nav className="flex justify-between items-center px-12 py-4 w-full max-w-[1440px] mx-auto">
            <div className="flex items-center gap-12">
              <img alt="Seiki Logo" className="h-8 w-auto object-contain" src="/grand_logo.png" />
            </div>
            <div className="flex items-center gap-6">
              <button onClick={logout} className="font-mono text-sm text-[#c7c4d9] hover:text-[#c2c1ff] transition-colors duration-300 uppercase tracking-widest cursor-pointer">
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
              className="portal-card seiki-gradient relative flex-1 group overflow-hidden rounded-xl border border-[#464556]/20 hover:border-[#c2c1ff]/40 shadow-2xl text-left cursor-pointer"
            >
              <div className="absolute inset-0 bg-[#c2c1ff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="relative h-full w-full flex flex-col items-start justify-end p-6 md:p-14">
                <span className="material-symbols-outlined text-[56px] text-[#c2c1ff] mb-6 group-hover:scale-110 transition-transform duration-700" style={{ fontVariationSettings: "'FILL' 1" }}>
                  deployed_code
                </span>
                <div className="space-y-4">
                  <h2 className="font-sans text-4xl md:text-6xl text-[#e8dff1] tracking-tighter leading-[1.1] font-bold">CRM</h2>
                  <p className="text-base md:text-lg text-[#c7c4d9] max-w-md">
                    Interface direct de gestion opérationnelle. Administration des leads, suivi du pipeline, analyses de conversion et outils d'automatisation intelligente.
                  </p>
                  <div className="flex items-center gap-3 pt-6 text-[#c2c1ff] font-mono text-sm uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
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
              className="portal-card seiki-gradient relative flex-1 group overflow-hidden rounded-xl border border-[#464556]/20 hover:border-[#ffe083]/40 shadow-2xl text-left cursor-pointer"
            >
              <div className="absolute inset-0 bg-[#ffe083]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="relative h-full w-full flex flex-col items-start justify-end p-6 md:p-14">
                <span className="material-symbols-outlined text-[56px] text-[#ffe083] mb-6 group-hover:scale-110 transition-transform duration-700" style={{ fontVariationSettings: "'FILL' 1" }}>
                  query_stats
                </span>
                <div className="space-y-4">
                  <h2 className="font-sans text-4xl md:text-6xl text-[#e8dff1] tracking-tighter leading-[1.1] font-bold">CONTENU</h2>
                  <p className="text-base md:text-lg text-[#c7c4d9] max-w-md">
                    Module d'analyse prédictive et de cartographie de marché. Outils IA de planification stratégique et d'aide à la décision.
                  </p>
                  <div className="flex items-center gap-3 pt-6 text-[#ffe083] font-mono text-sm uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
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
  ```

- [ ] **Step 2: Commit**
  ```bash
  rtk git add src/views/Portal.tsx
  rtk git commit -m "feat: add Portal gateway view component"
  ```

---

### Task 3: Implement Contenu View

**Files:**
- Create: [Contenu.tsx](file:///d:/Stage/SEIKI/Projet/src/views/Contenu.tsx)

**Interfaces:**
- Consumes: `useAuth` from `src/context/AuthContext`
- Produces: `<Contenu setActiveApp={setActiveApp} />` view component

- [ ] **Step 1: Write Contenu placeholder component**
  Create `src/views/Contenu.tsx` with a similar sidebar design and placeholder body:
  ```tsx
  import React from 'react';
  import { useAuth } from '../context/AuthContext';
  import { LayoutGrid, LogOut } from 'lucide-react';

  interface ContenuProps {
    setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
  }

  export const Contenu: React.FC<ContenuProps> = ({ setActiveApp }) => {
    const { logout } = useAuth();

    return (
      <div className="app-container">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark-wrap">
              <img src="/grand_logo.png" alt="Seiki" className="logo-mark" />
            </div>
            <div className="logo-sub">CONTENU — IA PREDICtive</div>
          </div>

          <nav className="nav">
            <button className="nav-item on">
              <LayoutGrid size={16} />
              <span>Dashboard</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
              <LayoutGrid size={14} style={{ marginRight: '6px' }} />
              Retour Portail
            </button>
            
            <button className="btn-logout" onClick={logout}>
              <LogOut size={14} style={{ marginRight: '6px' }} />
              Déconnexion
            </button>

            <div className="powered-by-seiki-footer">
              <span className="powered-text">Powered by</span>
              <img src="/seiki_logo_large.png" className="seiki-footer-logo" alt="Seiki Logo" />
              <span className="seiki-footer-name">Seiki</span>
            </div>
          </div>
        </aside>

        <main className="main-content flex items-center justify-center text-center p-8">
          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F4F6]">Module Contenu</h1>
            <p className="text-[#9CA3AF]">
              Ce module sera codé ultérieurement. Il proposera des fonctionnalités d'analyse prédictive et de cartographie de marché.
            </p>
            <button 
              onClick={() => setActiveApp('portal')}
              className="btn-logout"
              style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Retour au Portail
            </button>
          </div>
        </main>
      </div>
    );
  };
  ```

- [ ] **Step 2: Commit**
  ```bash
  rtk git add src/views/Contenu.tsx
  rtk git commit -m "feat: add Contenu view component placeholder"
  ```

---

### Task 4: Add Return to Portal in CRM Sidebar

**Files:**
- Modify: [SideBar.tsx](file:///d:/Stage/SEIKI/Projet/src/components/SideBar.tsx)

**Interfaces:**
- Consumes: `setActiveApp` callback.
- Produces: Navigation button above Logout inside the sidebar.

- [ ] **Step 1: Edit `SideBar.tsx`**
  Modify properties of `SideBar` to accept `setActiveApp` optional callback. Add button above Logout:
  ```tsx
  // ... imports including LayoutGrid if not present, wait:
  import { LayoutGrid } from 'lucide-react';
  ```
  And in interfaces:
  ```typescript
  interface SideBarProps {
    currentView: string;
    setView: (view: string) => void;
    setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
  }
  ```
  And in output rendering:
  ```tsx
  // Right above the logout button:
  {setActiveApp && (
    <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
      <LayoutGrid size={14} style={{ marginRight: '6px' }} />
      Retour Portail
    </button>
  )}
  ```

- [ ] **Step 2: Commit**
  ```bash
  rtk git add src/components/SideBar.tsx
  rtk git commit -m "feat: add Portail return button to SideBar"
  ```

---

### Task 5: Integrate Router State in App.tsx

**Files:**
- Modify: [App.tsx](file:///d:/Stage/SEIKI/Projet/src/App.tsx)

**Interfaces:**
- Consumes: `<Portal>`, `<Contenu>` views.
- Produces: Root rendering conditionally showing Portal, CRM workspace, or Contenu workspace.

- [ ] **Step 1: Modify `App.tsx`**
  Import the components and add state `activeApp`:
  ```tsx
  import { Portal } from './views/Portal';
  import { Contenu } from './views/Contenu';
  ```
  Inside `AppContent`:
  ```tsx
  const [activeApp, setActiveApp] = useState<'portal' | 'crm' | 'contenu'>('portal');
  ```
  And in rendering after checking authentication:
  ```tsx
  if (activeApp === 'portal') {
    return <Portal setActiveApp={setActiveApp} />;
  }

  if (activeApp === 'contenu') {
    return <Contenu setActiveApp={setActiveApp} />;
  }

  // Else render the CRM workspace shell:
  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <SideBar currentView={currentView} setView={setView} setActiveApp={setActiveApp} />
  ```

- [ ] **Step 2: Commit**
  ```bash
  rtk git add src/App.tsx
  rtk git commit -m "feat: integrate app router state in App.tsx"
  ```

# Sidebar Integration Design Specification

**Date**: 2026-07-20  
**Topic**: Integrating the developed sidebar design into Seiki CRM & Contenu

---

## 1. Overview
Integrate the sidebar component from `D:\Stage\SEIKI\Login Portal with Buttons` into `d:\Stage\SEIKI\Projet`, maintaining 100% of its visual aesthetics, collapse behaviors, responsive animations, and floating profile menus, while linking all navigation items to the application's view state.

---

## 2. Scope & Requirements
- **Design Preservation**: Keep exact colors (`#0d0d0d` background, `#c8b89a` CRM accent, `#5b5bd6` Contenu accent), fonts, Lucide icons, collapse transitions (220px ↔ 56px), and floating dropdown portal when collapsed.
- **Section Support**: Supports both `crm` and `contenu` sections via the `section` prop.
- **Navigation Wiring**:
  - **CRM Items**: `Pipeline` (`/crm/pipeline`), `Leads` (`/crm/leads`), `Tâches` (`/crm/taches`), `Agenda` (`/crm/agenda`), `Statistiques` (`/crm/statistiques`), `Dashboard CODIR` (`/crm/dashboard-codir`).
  - **Contenu Items**: `Posts` (`/contenu/posts`), `Prospection` (`/contenu/prospection`).
  - **Profile Submenu**:
    - "Retour au portail" → `setActiveApp('portal')`
    - "Paramètres" → `setView('settings')`
    - "Se déconnecter" → `logout()`

---

## 3. Architecture & Interface

### Component: `src/components/Sidebar.tsx`
```typescript
type Section = "crm" | "contenu";

interface SidebarProps {
  section: Section;
  currentView?: string;
  setView?: (view: string) => void;
  contenuView?: 'linkedin' | 'prospection';
  setContenuView?: (view: 'linkedin' | 'prospection') => void;
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}
```

---

## 4. Affected Files
1. `src/components/Sidebar.tsx` (New component created from `Login Portal with Buttons/src/app/components/Sidebar.tsx`)
2. `src/App.tsx` (Replaces legacy sidebar with `<Sidebar section="crm" ... />`)
3. `src/views/Contenu.tsx` (Replaces legacy inline sidebar with `<Sidebar section="contenu" ... />`)

---

## 5. Verification
- Verify collapse/expand toggle on both CRM and Contenu views.
- Verify view transitions when clicking navigation items in CRM and Contenu.
- Verify "Retour au portail", "Paramètres", and "Se déconnecter" actions in both expanded inline submenu and collapsed floating portal submenu.

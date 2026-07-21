# Design Specification: React Router v7 Integration for Seiki CRM

**Date**: 2026-07-21  
**Status**: Approved by User  
**Author**: Full-Stack Developer  

---

## 1. Overview & Objective

Replace the manual `useState('view')` and `useState('activeApp')` conditional rendering logic in `App.tsx` with standard production-grade URL routing using `react-router-dom`.

### Goals
- Enable direct URL navigation and deep-linking (e.g. `/crm/leads`, `/crm/tasks`).
- Support browser back/forward buttons and page refreshes without losing current page state.
- Remove prop-drilling of `setView` and `setActiveApp` callbacks.
- Protect private routes with a clean `<ProtectedRoute>` wrapper checking `AuthContext`.

---

## 2. Target Route Architecture

```
/login                                (Public Route)

[ProtectedRoute Layout Wrapper]       (Checks authentication, redirects to /login if unauthenticated)
├── /                                 (Redirects to /portal)
├── /portal                           (App Launcher Portal)
│
├── /crm                              (CrmLayout Wrapper with CRM Sidebar & <Outlet />)
│   ├── /crm                          (Index Route -> Redirects to /crm/pipeline)
│   ├── /crm/pipeline                 (Pipeline Kanban View)
│   ├── /crm/leads                    (Leads List & Table View)
│   ├── /crm/leads/add                (Add Lead View)
│   ├── /crm/tasks                    (Tasks View)
│   ├── /crm/agenda                   (Agenda & Calendar View)
│   ├── /crm/stats                    (Statistics & Metrics View)
│   ├── /crm/codir                    (CODIR Dashboard View)
│   └── /crm/settings                 (Settings View)
│
└── /contenu                          (ContenuLayout Wrapper with Content Sidebar & <Outlet />)
    ├── /contenu                      (Index Route -> Redirects to /contenu/linkedin)
    ├── /contenu/linkedin             (LinkedIn Posts & Scheduler View)
    └── /contenu/prospection          (Prospection Module View)

*                                     (Catch-all Fallback -> Redirects to /portal)
```

---

## 3. Component & File Changes

### New Components to Create
1. `src/components/ProtectedRoute.tsx`: Route guard checking `useAuth().isAuthenticated` and rendering `<Navigate to="/login" replace />` if unauthenticated.
2. `src/layouts/CrmLayout.tsx`: Shared CRM container with `<Sidebar section="crm" />` and `<Outlet />`.
3. `src/layouts/ContenuLayout.tsx`: Shared Content container with `<Sidebar section="contenu" />` and `<Outlet />`.

### Components to Update
1. `package.json`: Add `react-router-dom` dependency (`npm install react-router-dom`).
2. `src/App.tsx`: Replace `useState('view')` state machine with `<BrowserRouter>` and `<Routes>`.
3. `src/components/Sidebar.tsx`: Update navigation click handlers to use React Router's `useNavigate()` and `useLocation()` for active tab highlighting instead of `currentView` props.
4. `src/views/Portal.tsx`: Update app launch cards to navigate using `useNavigate()` to `/crm` or `/contenu`.
5. `src/views/Contenu.tsx`: Refactor internal tab switching to use child routes (`/contenu/linkedin`, `/contenu/prospection`).
6. `src/components/Sidebar.test.tsx`: Update unit tests to wrap `<Sidebar />` in a `<MemoryRouter>`.

---

## 4. Verification Plan

1. **Package Installation**: Run `npm install react-router-dom` and verify clean installation without peer dependency conflicts.
2. **Build Verification**: Run `npm run build` (`tsc -b && vite build`) to confirm zero TypeScript signature errors.
3. **Automated Unit Tests**: Run `npm run test` (`vitest run`) to verify all existing tests pass with router providers.
4. **Manual Navigation Test**:
   - Navigate to `/crm/leads`, refresh the browser, verify page remains on Leads.
   - Click sidebar items, verify URL updates smoothly.
   - Use browser Back and Forward buttons to verify browser history works as expected.

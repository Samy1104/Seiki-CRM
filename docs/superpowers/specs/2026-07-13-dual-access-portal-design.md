# Design Spec: Dual Access Portal

Introduce an entry portal (gateway) after login that routes users to either the CRM or the Contenu tool.

## Requirements

1. **Gateway Portal**: Visible after user logs in. Show two cards:
   - Card 1: CRM (access to current CRM).
   - Card 2: Contenu (placeholder tool for future).
2. **Design**: Use design from Stitch screen `26fd9e46ea274b1a9f2e393bc0858d8b`.
3. **Decoupled Architecture**: Independent layouts for CRM and Contenu.
4. **Navigation**:
   - Sidebar inside CRM should have a "Portail" button right above Logout to return to the gateway.
   - Contenu view has its own sidebar with "Portail" and "Déconnexion" options.

## Components & Files

- `src/App.tsx`: Manage active application state (`'portal' | 'crm' | 'contenu'`).
- `src/views/Portal.tsx` [NEW]: Render the portal selection cards with Tailwind CSS, hover 3D tilt interactions, and Logout.
- `src/views/Contenu.tsx` [NEW]: Placeholder app layout, sidebar navigation, return to portal button.
- `src/components/SideBar.tsx`: Add return to portal button above the logout button.

## Interaction Flow

```
                +-------------+
                |    Login    |
                +------+------+
                       |  (Success)
                       v
                +------+------+
                |   Portal    +<-------+
                +-+--------+--+        |
                  |        |           |
             CRM  |        | Contenu   |
                  v        v           | (Portal click)
               +--+--+  +--+--+        |
               | CRM |  | Cont |-------+
               +-----+  +------+
```

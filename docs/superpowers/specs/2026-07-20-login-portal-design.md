# Design Spec: Login Portal Integration

**Date**: 2026-07-20  
**Status**: Approved by User  

## Overview
Replace the existing login page in `src/views/Login.tsx` with the newly designed login portal from `D:\Stage\SEIKI\Login Portal with Buttons\src\app\pages\Login.tsx`.

## Key Requirements & Preserved Elements

1. **Exact UI & Layout**:
   - Replicate the minimal, dark background styling (`#0d0d0d`).
   - Use custom underline inputs for Email (`vous@exemple.com`) and Password (`••••••••`) with subtle focus border color transitions (`#c8b89a`).
   - Include the show/hide password toggle button with `Eye` / `EyeOff` icons from `lucide-react`.
   - Use the full-width primary button `"SE CONNECTER"` with an animated `ArrowRight` icon.
   - Include the bottom caption `"POWERED BY SEIKI"`.

2. **Preserved Attributes from Original Page**:
   - **Logo Size**: Logo height set to `h-16 w-auto` (64px height) using `/grand_logo.png` from `public/`.
   - **Headline Font**: Headline text `"Sharper decisions with mobility data"` uses the original `font-display` font family (`'Sora', system-ui, sans-serif`).

3. **Authentication & Error Handling**:
   - Integrated with `useAuth()` hook from `src/context/AuthContext.tsx`.
   - Validate empty inputs before submission ("Veuillez entrer votre email et votre mot de passe").
   - Display validation and authentication error messages in red (`#F87171`) above the submit button.

4. **Testing**:
   - Update `src/views/Login.test.tsx` to match the new button label (`Se connecter`) and placeholder (`vous@exemple.com`).

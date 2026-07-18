// ============================================================
// edgeFunctions.ts
// Point d'appel unique pour les Supabase Edge Functions appelées
// depuis le navigateur via fetch (au lieu de supabase.functions.invoke,
// pour garder le contrôle exact du body/headers). Centralise la
// construction d'URL, l'auth, et le parsing JSON commun à
// send-email, flush-send-queue, generate-linkedin-post, learn-linkedin-style...
//
// Ne vérifie que le statut HTTP (response.ok) : certaines fonctions
// renvoient un champ `success` dans leur body (send-email,
// generate-linkedin-post...), d'autres non (flush-send-queue) — c'est
// à l'appelant de vérifier ce champ si sa fonction en renvoie un.
// ============================================================

import { supabase } from './supabaseClient';

export class EdgeFunctionError extends Error {}

/** Appelle une Edge Function Supabase en POST JSON et retourne son body parsé. */
export async function callEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Le token de session utilisateur (pas la clé anon statique) sert de preuve
  // d'authentification côté Edge Function — sans ça, n'importe qui extrayant
  // la clé anon publique du bundle frontend pourrait déclencher ces fonctions
  // (et les appels payants Gemini/Resend/LinkedIn derrière) sans être un
  // membre connecté de l'équipe.
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseAnonKey;

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new EdgeFunctionError(data?.error || `Erreur ${functionName} (${response.status})`);
  }

  return data as T;
}

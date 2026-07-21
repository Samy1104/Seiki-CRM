import { supabase } from './supabaseClient';

export class EdgeFunctionError extends Error {}

/** Appelle une Edge Function Supabase via le SDK client Supabase. */
export async function callEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body as Record<string, any>,
    });

    if (error) {
      let errMsg = error.message;
      if (error.context && typeof error.context === 'object' && 'json' in error.context) {
        try {
          const errBody = await (error.context as Response).json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {
          // ignorer l'erreur de parsing JSON
        }
      }
      throw new EdgeFunctionError(errMsg || `Erreur lors de l'exécution de la fonction ${functionName}`);
    }

    if (!data) {
      throw new EdgeFunctionError(`Réponse vide reçue de la fonction ${functionName}`);
    }

    return data as T;
  } catch (err) {
    if (err instanceof EdgeFunctionError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Failed to fetch') || msg.includes('fetch') || msg.includes('NetworkError')) {
      throw new EdgeFunctionError(
        `Impossible de contacter l'Edge Function (${functionName}). Vérifiez votre connexion réseau et la configuration Supabase.`
      );
    }
    throw new EdgeFunctionError(msg);
  }
}

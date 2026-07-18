// ============================================================
// _shared/fetchWithTimeout.ts
// Un fetch qui hangerait indéfiniment (Gemini/Resend/LinkedIn lents ou
// muets) bloquerait toute la boucle d'un batch (flush-send-queue,
// publish-linkedin-post) jusqu'au timeout de la plateforme Edge
// Functions — retardant tout le reste de la file. Ce wrapper impose
// une limite de temps explicite et plus courte à chaque appel externe.
// ============================================================

const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Requête vers ${input} annulée après ${timeoutMs}ms sans réponse`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

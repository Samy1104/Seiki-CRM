/**
 * Shared shape for the "fetch data on mount" pattern repeated across views:
 * try the loader, report the error the same way everywhere, always clear
 * the loading flag. Callers keep full control of what they fetch/set —
 * this only removes the boilerplate wrapper around it.
 */
export async function withLoadingState(
  task: () => Promise<void>,
  opts: { setLoading: (loading: boolean) => void; onError: (err: unknown) => void }
): Promise<void> {
  try {
    await task();
  } catch (err) {
    opts.onError(err);
  } finally {
    opts.setLoading(false);
  }
}

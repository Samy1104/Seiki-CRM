import { useEffect, useRef, type DependencyList } from 'react';

/**
 * Runs `loader` once on mount, and again whenever a value in `deps` changes
 * (defaults to mount-only). Uses a ref so the effect never needs `loader`
 * itself in its dependency array — avoids the react-hooks/exhaustive-deps
 * warning that comes from redefining the loader function on every render,
 * without re-running the effect on every render either.
 */
export function useLoadOnMount(loader: () => void | Promise<void>, deps: DependencyList = []): void {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    loaderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

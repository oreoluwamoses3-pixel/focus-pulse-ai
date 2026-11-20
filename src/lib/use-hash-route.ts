import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'flow' | 'decomposer';

export type RouteResult =
  | { route: Route; notFound: false }
  | { route: null; notFound: true };

const VALID: Route[] = ['dashboard', 'flow', 'decomposer'];

function readRoute(): RouteResult {
  if (typeof window === 'undefined') return { route: 'dashboard', notFound: false };
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  if (raw === '') return { route: 'dashboard', notFound: false };
  if ((VALID as string[]).includes(raw)) return { route: raw as Route, notFound: false };
  return { route: null, notFound: true };
}

export function useHashRoute(): [RouteResult, (r: Route) => void] {
  const [result, setResult] = useState<RouteResult>(readRoute);

  useEffect(() => {
    const onChange = () => setResult(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (r: Route) => {
    if (result.route === r) return;
    window.location.hash = `/${r}`;
  };

  return [result, navigate];
}

export const ROUTE_TITLES: Record<Route, string> = {
  dashboard: 'Dashboard · FocusPulse AI',
  flow: 'Task Flow · FocusPulse AI',
  decomposer: 'AI Decomposer · FocusPulse AI',
};

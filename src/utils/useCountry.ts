/* ============================================================================
 * useCountry — single source of truth for the visitor's country and currency.
 *
 * Precedence on first read (synchronous, so the first paint is correct
 * for repeat visitors):
 *   1. ?country=XX URL param  (testing / share-from-India link)
 *   2. localStorage override  (user clicked 'Change' on the pricing page)
 *   3. sessionStorage cache   (already detected this tab)
 *   4. navigator.language     (en-IN, hi-IN, etc. → IN as an optimistic guess)
 *   5. 'US' default
 *
 * After mount, hits /api/geo (Cloudflare / Vercel headers, accept-language,
 * ipapi.co fallback) and replaces the optimistic guess if it differs.
 *
 * The result is cached at the module level so concurrent components on the
 * same page share one fetch.
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';

const COUNTRY_DEFAULT = 'US';
const STORAGE_OVERRIDE = 'fl_country_override';
const SESSION_CACHE    = 'fl_country_detected';

type Country = string;          // ISO-3166 alpha-2
export type Currency = 'INR' | 'USD';

let moduleCache: { country: Country } | null = null;
let inflight: Promise<Country> | null = null;

function readUrlCountry(): Country | null {
  try {
    const v = new URLSearchParams(window.location.search).get('country');
    return v && /^[A-Z]{2}$/i.test(v) ? v.toUpperCase() : null;
  } catch { return null; }
}

function readStorageOverride(): Country | null {
  try {
    const v = localStorage.getItem(STORAGE_OVERRIDE);
    return v && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch { return null; }
}

function readSessionCache(): Country | null {
  try {
    const v = sessionStorage.getItem(SESSION_CACHE);
    return v && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch { return null; }
}

function readNavigatorHint(): Country | null {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (langs.some(l => /-IN$/i.test(l || ''))) return 'IN';
  } catch { /* noop */ }
  return null;
}

function initialCountry(): Country {
  return (
    readUrlCountry()
    || readStorageOverride()
    || readSessionCache()
    || moduleCache?.country
    || readNavigatorHint()
    || COUNTRY_DEFAULT
  );
}

async function fetchCountry(): Promise<Country> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // Pass the URL ?country= through so the server can honor it explicitly.
      const u = new URLSearchParams(window.location.search).get('country');
      const qs = u && /^[A-Z]{2}$/i.test(u) ? `?country=${encodeURIComponent(u)}` : '';
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`/api/geo${qs}`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error('geo unavailable');
      const j = await r.json();
      const c = String(j.country || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) throw new Error('invalid geo');
      moduleCache = { country: c };
      try { sessionStorage.setItem(SESSION_CACHE, c); } catch { /* noop */ }
      return c;
    } catch {
      const fallback = readNavigatorHint() || COUNTRY_DEFAULT;
      moduleCache = { country: fallback };
      return fallback;
    }
  })();
  return inflight;
}

export function useCountry() {
  const [country, setCountry] = useState<Country>(initialCountry);
  const [ready, setReady] = useState<boolean>(() => Boolean(
    readUrlCountry() || readStorageOverride() || readSessionCache() || moduleCache
  ));

  useEffect(() => {
    // URL or localStorage override wins — never re-detect over them.
    const ovr = readUrlCountry() || readStorageOverride();
    if (ovr) { setCountry(ovr); setReady(true); return; }
    if (moduleCache) { setCountry(moduleCache.country); setReady(true); return; }

    let cancelled = false;
    fetchCountry().then((c) => {
      if (cancelled) return;
      setCountry(c);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const setOverride = useCallback((c: Country | null) => {
    try {
      if (c) localStorage.setItem(STORAGE_OVERRIDE, c);
      else localStorage.removeItem(STORAGE_OVERRIDE);
    } catch { /* noop */ }
    if (c) {
      setCountry(c);
    } else {
      const detected = moduleCache?.country || readSessionCache() || readNavigatorHint() || COUNTRY_DEFAULT;
      setCountry(detected);
    }
  }, []);

  // Used by the tiny 'Change' link on /pricing — flips between INR and USD.
  const toggleCurrency = useCallback(() => {
    setOverride(country === 'IN' ? 'US' : 'IN');
  }, [country, setOverride]);

  const currency: Currency = country === 'IN' ? 'INR' : 'USD';
  return { country, currency, ready, setOverride, toggleCurrency };
}

/* ---------- Formatting helpers ---------- */

export function formatPrice(amount: number, currency: Currency): string {
  if (currency === 'INR') {
    // Indian grouping: 1,00,000 (1 lakh), 10,00,000 (10 lakh), 1,00,00,000 (1 crore)
    return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
  }
  return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

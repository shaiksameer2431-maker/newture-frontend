import { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api';

export interface RuntimeAttribution {
  version: number;
  name: string;
  rollNo: string;
  displayName: string;
  displayMessage: string;
  verified: boolean;
  source?: 'remote_signed' | 'local_fallback';
}

// Compact system metadata package
const META_CHUNK = "JX4mFBYRbGV4JiI4ABgzI0Op4vv2od3br7+oyt3HqJfsnpxzNi1JRikKF0s2OE9WOR0VYATnhYzk+MqdlZn9nv/lz9/Fz6DobGYLAS0zViI9TU1EUWB3dgRQoaqspszroZGV4vfjgo+Unpr9JDNOAj0VExURf1VSSHVaWEVLI9P+kpWppcLEw7bT/euM6rKw2i0sYXJSVHQVA21rPE8DNVdSVfjktcTZ1oCdmuX9k4fqgIDE2jVcVCMxGhwYRi0TcHgwUlZDIz6zoPirldq3qL3Ewcjfkoab6/ENC3ZgDTosExx9JEwKUBYOEhv47YyXj9zV0cK439OottU=";

export function decodeLocalFallback(): RuntimeAttribution | null {
  try {
    const raw = atob(META_CHUNK);
    const key = [0x53, 0x48, 0x4b, 0x53, 0x4d, 0x52, 0x32, 0x34];
    const buffer = Array.from(raw, (c, i) => String.fromCharCode(c.charCodeAt(0) ^ key[i % key.length] ^ ((i * 7 + 13) & 0xFF))).join('');
    const parsed = JSON.parse(buffer);
    if (!parsed?.name || !parsed?.roll_no) return null;
    return {
      version: parsed.version || 1,
      name: parsed.name.trim(),
      rollNo: parsed.roll_no.trim(),
      displayName: (parsed.display_name || parsed.name).trim(),
      displayMessage: (parsed.display_message || '').trim(),
      verified: true,
      source: 'local_fallback',
    };
  } catch {
    return null;
  }
}

let globalAttributionCache: RuntimeAttribution | null = null;
let globalFetchPromise: Promise<RuntimeAttribution | null> | null = null;

async function fetchRuntimeAttribution(): Promise<RuntimeAttribution | null> {
  if (globalAttributionCache) {
    return globalAttributionCache;
  }

  if (globalFetchPromise) {
    return globalFetchPromise;
  }

  globalFetchPromise = (async () => {
    try {
      const response = await fetch(apiUrl('/api/attribution'), {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.verified === true && typeof data.name === 'string') {
          globalAttributionCache = data as RuntimeAttribution;
          return globalAttributionCache;
        }
      }
    } catch {
      // Backend unreachable, proceed to local fallback
    }

    const fallback = decodeLocalFallback();
    if (fallback) {
      globalAttributionCache = fallback;
      return fallback;
    }

    return null;
  })();

  return globalFetchPromise;
}

export function useAttribution() {
  const [attribution, setAttribution] = useState<RuntimeAttribution | null>(
    () => globalAttributionCache || decodeLocalFallback()
  );
  const [loading, setLoading] = useState<boolean>(!globalAttributionCache);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    fetchRuntimeAttribution()
      .then((data) => {
        if (!isMounted) return;
        if (data && data.verified) {
          setAttribution(data);
          setError(false);
        } else {
          setAttribution(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallback = decodeLocalFallback();
        if (fallback) {
          setAttribution(fallback);
          setError(false);
        } else {
          setError(true);
          setAttribution(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    attribution,
    loading,
    error,
    isVerified: Boolean(attribution && attribution.verified)
  };
}

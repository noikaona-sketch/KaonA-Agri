import { getOptionalPublicLiffId } from '@/lib/env/public-env';

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

type LiffInstance = {
  init: (params: { liffId: string }) => Promise<void>;
};

declare global {
  interface Window {
    liff?: LiffInstance;
  }
}

const liffId = getOptionalPublicLiffId();

export type LiffRuntimeMode = 'production' | 'preview' | 'direct';

export type LiffDiagnostics = {
  configPresent: boolean;
  sdkLoad: 'success' | 'failed' | 'not_attempted';
  initError: string | null;
  runtimeMode: LiffRuntimeMode;
};

const diagnostics: LiffDiagnostics = {
  configPresent: Boolean(liffId),
  sdkLoad: 'not_attempted',
  initError: null,
  runtimeMode: 'direct',
};

let loadPromise: Promise<LiffInstance> | null = null;
let isInitialized = false;

async function loadLiffSdk(): Promise<LiffInstance> {
  if (window.liff) {
    return window.liff;
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LIFF_SDK_URL;
      script.async = true;
      script.onload = () => {
        if (window.liff) {
          diagnostics.sdkLoad = 'success';
          resolve(window.liff);
          return;
        }
        diagnostics.sdkLoad = 'failed';
        reject(new Error('LIFF SDK loaded but window.liff is unavailable.'));
      };
      script.onerror = () => {
        diagnostics.sdkLoad = 'failed';
        reject(new Error('Failed to load LIFF SDK script.'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

function detectRuntimeMode(): LiffRuntimeMode {
  if (typeof window === 'undefined') return 'direct';
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.vercel.app')) return 'preview';
  if (host.includes('localhost') || host === '127.0.0.1') return 'direct';
  return 'production';
}

export function getLiffDiagnostics() {
  return { ...diagnostics };
}

// Fallback strategy: load LIFF from LINE CDN at runtime to avoid npm dependency install issues.
export async function initLiff(): Promise<LiffInstance | null> {
  diagnostics.runtimeMode = detectRuntimeMode();
  if (typeof window === 'undefined' || !liffId) {
    diagnostics.initError = !liffId ? 'LIFF login is required' : null;
    return null;
  }
  try {
    const liff = await loadLiffSdk();

    if (!isInitialized) {
      await liff.init({ liffId });
      isInitialized = true;
    }

    diagnostics.initError = null;
    return liff;
  } catch {
    diagnostics.initError = diagnostics.sdkLoad === 'failed' ? 'LIFF SDK failed to load' : 'LIFF init failed';
    throw new Error(diagnostics.initError);
  }
}

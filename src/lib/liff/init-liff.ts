import { getOptionalPublicLiffId } from '@/lib/env/public-env';

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

type LiffInstance = {
  init: (params: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (params?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
};

export type LiffSdkLoadStatus = 'not_attempted' | 'success' | 'failed';
export type RuntimeMode = 'production' | 'preview' | 'direct';

export type LiffRuntimeDiagnostics = {
  liffConfigPresent: boolean;
  sdkLoad: LiffSdkLoadStatus;
  liffInitError: string | null;
  runtimeMode: RuntimeMode;
};

declare global {
  interface Window {
    liff?: LiffInstance;
  }
}

const liffId = getOptionalPublicLiffId();

let loadPromise: Promise<LiffInstance> | null = null;
let isInitialized = false;
let sdkLoadStatus: LiffSdkLoadStatus = 'not_attempted';
let liffInitErrorMessage: string | null = null;

function resolveRuntimeMode(): RuntimeMode {
  if (typeof window === 'undefined') return 'direct';
  if (window.location.hostname.endsWith('.vercel.app')) return 'preview';
  if (window.location.hostname === 'localhost') return 'direct';
  return 'production';
}

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
          sdkLoadStatus = 'success';
          resolve(window.liff);
          return;
        }
        sdkLoadStatus = 'failed';
        reject(new Error('LIFF SDK loaded but window.liff is unavailable.'));
      };
      script.onerror = () => {
        sdkLoadStatus = 'failed';
        reject(new Error('Failed to load LIFF SDK script.'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

// Fallback strategy: load LIFF from LINE CDN at runtime to avoid npm dependency install issues.
export async function initLiff(): Promise<LiffInstance | null> {
  if (typeof window === 'undefined' || !liffId) {
    return null;
  }

  const liff = await loadLiffSdk();

  if (!isInitialized) {
    try {
      await liff.init({ liffId });
      isInitialized = true;
      liffInitErrorMessage = null;
    } catch {
      liffInitErrorMessage = 'LIFF initialization failed.';
      throw new Error('LIFF initialization failed.');
    }
  }

  return liff;
}

export async function ensureLiffSignedIn(): Promise<void> {
  const liff = await initLiff();

  if (!liff || liff.isLoggedIn()) {
    return;
  }

  liff.login({ redirectUri: window.location.href });
}

export function getLiffRuntimeDiagnostics(): LiffRuntimeDiagnostics {
  return {
    liffConfigPresent: Boolean(liffId),
    sdkLoad: sdkLoadStatus,
    liffInitError: liffInitErrorMessage,
    runtimeMode: resolveRuntimeMode(),
  };
}

export async function ensureLiffIdToken(): Promise<string | null> {
  const liff = await initLiff();
  if (!liff) return null;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  return liff.getIDToken();
}

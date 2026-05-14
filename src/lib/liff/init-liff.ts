import { getOptionalPublicLiffId } from '@/lib/env/public-env';
import type { LiffBridgeDiagnostics, LiffRuntimeMode } from '@/shared/auth/auth-types';

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

type LiffInstance = {
  init: (params: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (params?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffInstance;
  }
}

const liffId = getOptionalPublicLiffId();

let loadPromise: Promise<LiffInstance> | null = null;
let isInitialized = false;

const diagnostics: LiffBridgeDiagnostics = {
  supabaseUrlPresent: false,
  supabaseAnonKeyPresent: false,
  supabaseClientCreated: false,
  liffConfigPresent: Boolean(liffId),
  liffSdkLoad: 'not_attempted',
  liffInitAttempted: false,
  liffInitSuccess: false,
  liffInitError: null,
  liffWindowPresent: false,
  runtimeMode: 'direct',
  liffInitialized: false,
  liffLoggedIn: false,
  idTokenPresent: false,
  bridgeAttempted: false,
  bridgeSuccess: false,
  bridgeErrorMessage: null,
};

function detectRuntimeMode(): LiffRuntimeMode {
  if (typeof window === 'undefined') return 'direct';

  const host = window.location.hostname.toLowerCase();

  if (host === 'kaon-a-agri.vercel.app') return 'production';
  if (host.endsWith('.vercel.app')) return 'preview';
  if (host === 'localhost' || host === '127.0.0.1') return 'direct';

  return 'production';
}

function setLiffSessionDiagnostics(liff: LiffInstance | null) {
  diagnostics.liffInitialized = Boolean(liff && isInitialized);
  diagnostics.liffWindowPresent = typeof window !== 'undefined' && Boolean(window.liff);

  if (!liff) {
    diagnostics.liffLoggedIn = false;
    diagnostics.idTokenPresent = false;
    return;
  }

  const loggedIn = liff.isLoggedIn();
  diagnostics.liffLoggedIn = loggedIn;
  diagnostics.idTokenPresent = loggedIn ? Boolean(liff.getIDToken()) : false;
}

export function getLiffBridgeDiagnostics(): LiffBridgeDiagnostics {
  if (typeof window !== 'undefined') {
    diagnostics.runtimeMode = detectRuntimeMode();
    diagnostics.liffWindowPresent = Boolean(window.liff);
  }

  return { ...diagnostics };
}

async function loadLiffSdk(): Promise<LiffInstance> {
  // DEV BYPASS: ไม่โหลด SDK เลย
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_LINE === 'true') {
    throw new Error('dev-bypass: skip LIFF SDK');
  }
  if (window.liff) {
    diagnostics.liffSdkLoad = 'success';
    diagnostics.liffWindowPresent = true;
    return window.liff;
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LIFF_SDK_URL;
      script.async = true;
      script.onload = () => {
        diagnostics.liffWindowPresent = Boolean(window.liff);

        if (window.liff) {
          diagnostics.liffSdkLoad = 'success';
          resolve(window.liff);
          return;
        }

        diagnostics.liffSdkLoad = 'failed';
        reject(new Error('LIFF SDK failed to load'));
      };
      script.onerror = () => {
        diagnostics.liffSdkLoad = 'failed';
        diagnostics.liffWindowPresent = false;
        reject(new Error('LIFF SDK failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

// Fallback strategy: load LIFF from LINE CDN at runtime to avoid npm dependency install issues.
export async function initLiff(): Promise<LiffInstance | null> {
  // DEV BYPASS: หยุด LIFF init/redirect ทั้งหมด
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_LINE === 'true') {
    return null;
  }
  if (typeof window === 'undefined') {
    return null;
  }

  diagnostics.runtimeMode = detectRuntimeMode();
  diagnostics.liffConfigPresent = Boolean(liffId);

  if (!liffId) {
    diagnostics.liffInitError = 'LIFF config missing';
    setLiffSessionDiagnostics(null);
    return null;
  }

  try {
    const liff = await loadLiffSdk();
    diagnostics.liffInitAttempted = true;

    if (!isInitialized) {
      await liff.init({ liffId });
      isInitialized = true;
    }

    diagnostics.liffInitSuccess = true;
    diagnostics.liffInitError = null;
    setLiffSessionDiagnostics(liff);

    if (!liff.isLoggedIn()) {
      diagnostics.bridgeErrorMessage = 'LIFF login is required';
      liff.login({ redirectUri: window.location.href });
      return null;
    }

    return liff;
  } catch (error: unknown) {
    diagnostics.liffInitSuccess = false;
    diagnostics.liffInitError = error instanceof Error ? error.message : 'LIFF init failed';
    setLiffSessionDiagnostics(null);
    return null;
  }
}

export async function ensureLiffIdToken(): Promise<string | null> {
  // DEV BYPASS: ถ้าตั้ง NEXT_PUBLIC_DEV_BYPASS_LINE=true → return mock token
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_LINE === 'true') {
    return 'dev-bypass-token';
  }

  const liff = await initLiff();

  if (!liff) {
    return null;
  }

  if (!liff.isLoggedIn()) {
    diagnostics.bridgeErrorMessage = 'LIFF login is required';
    liff.login({ redirectUri: window.location.href });
    return null;
  }

  const idToken = liff.getIDToken();
  setLiffSessionDiagnostics(liff);

  return idToken;
}

export async function getLiffBridgeSnapshot(): Promise<LiffBridgeDiagnostics> {
  const liff = await initLiff();
  setLiffSessionDiagnostics(liff);

  return getLiffBridgeDiagnostics();
}

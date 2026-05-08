import { getOptionalPublicLiffId } from '@/lib/env/public-env';

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

type LiffInstance = {
  init: (params: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (params?: { redirectUri?: string }) => void;
};

declare global {
  interface Window {
    liff?: LiffInstance;
  }
}

const liffId = getOptionalPublicLiffId();

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
          resolve(window.liff);
          return;
        }
        reject(new Error('LIFF SDK loaded but window.liff is unavailable.'));
      };
      script.onerror = () => reject(new Error('Failed to load LIFF SDK script.'));
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
    await liff.init({ liffId });
    isInitialized = true;
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

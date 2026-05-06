import liff from '@line/liff';

const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

let isInitialized = false;

export async function initLiff(): Promise<typeof liff | null> {
  if (!liffId || typeof window === 'undefined') {
    return null;
  }

  if (!isInitialized) {
    await liff.init({ liffId });
    isInitialized = true;
  }

  return liff;
}

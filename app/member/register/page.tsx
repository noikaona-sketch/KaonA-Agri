'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MemberRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`/register${query}`);
  }, [router]);

  return null;
}

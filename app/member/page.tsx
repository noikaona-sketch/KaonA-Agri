'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /member redirect ไป /profile (same content)
export default function MemberPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/profile'); }, [router]);
  return null;
}

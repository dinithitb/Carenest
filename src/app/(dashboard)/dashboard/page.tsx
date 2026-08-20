'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || !session.user) {
      router.replace('/login');
      return;
    }

    const role = session.user.role;
    if (role === 'ADMIN') {
      router.replace('/admin');
    } else if (role === 'MIDWIFE') {
      router.replace('/midwife');
    } else {
      router.replace('/mother');
    }
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
    </div>
  );
}

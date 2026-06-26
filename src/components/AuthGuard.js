'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && pathname !== '/login') {
      setAuthorized(false);
      router.push('/login');
    } else if (token && pathname === '/login') {
      setAuthorized(false);
      router.push('/classes');
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F2F2F7', color: '#8E8E93', fontFamily: 'system-ui' }}>
        <p>正在验证权限...</p>
      </div>
    );
  }

  return children;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !pathname) return;

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
  }, [mounted, pathname, router]);

  // 1. 未挂载前直接渲染 children，保证 SSR & 客户端首帧水合完全一致，杜绝 Mismatch 报错
  if (!mounted) {
    return children;
  }

  // 2. 对于白名单登录页，直接放行展示，避免加载状态卡顿
  if (pathname === '/login') {
    return children;
  }

  // 3. 拦截未授权受保护路由
  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F2F2F7', color: '#8E8E93', fontFamily: 'system-ui' }}>
        <p>正在验证权限...</p>
      </div>
    );
  }

  return children;
}

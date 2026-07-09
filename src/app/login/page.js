'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 初始化检测本地是否有 theme 并应用
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMessage('请输入用户名和密码');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        username,
        password,
      });

      const { token, teacher } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('teacherName', teacher.name);

      // 成功后跳转到班级列表页
      router.push('/classes');
    } catch (error) {
      console.error('Login failed:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('登录失败，请检查网络或后端服务');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 装饰性渐变背景光圈 */}
      <div className="bg-glow circle-1"></div>
      <div className="bg-glow circle-2"></div>

      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="logo-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="url(#logoGrad)" />
              <path d="M12 7V17M7 12H17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00C6FF" />
                  <stop offset="1" stopColor="#0072FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>签到系统</h1>
          <p className="subtitle">教师端登录</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* 错误提示 */}
          {errorMessage && (
            <div className="error-banner">
              <svg className="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="input-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              placeholder="请输入您的账号"
              autoComplete="username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="请输入密码"
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : <span>登录</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

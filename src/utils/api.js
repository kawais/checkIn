const api = {
  get: async (url, options = {}) => {
    return api.request(url, { ...options, method: 'GET' });
  },
  post: async (url, body, options = {}) => {
    return api.request(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
    });
  },
  request: async (url, options = {}) => {
    let finalUrl = url;
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        finalUrl = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
      }
      delete options.params;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(finalUrl, {
      ...options,
      headers
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('teacherName');
        window.location.href = '/login';
      }
      throw new Error('未授权，请登录');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || '请求失败');
      err.response = { status: response.status, data };
      throw err;
    }

    const data = await response.json();
    return { data };
  }
};

export default api;

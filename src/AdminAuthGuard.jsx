import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Returns common Authorization headers with Bearer token
 */
export function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('admin_token');
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Global helper to handle token expiration or unauthorized responses
 */
export function handleAuthError(status, navigate) {
  if (status === 401 || status === 403) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_logged_in');
    if (navigate) {
      navigate('/admin', { replace: true, state: { sessionExpired: true } });
    } else {
      window.location.href = '/admin';
    }
    return true;
  }
  return false;
}

/**
 * Route protection wrapper for administrative panels
 */
export default function AdminAuthGuard({ children }) {
  const token = localStorage.getItem('admin_token');
  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';

  if (!token || !isLoggedIn) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

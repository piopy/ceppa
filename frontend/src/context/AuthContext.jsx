import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Username is already set during login/register
      // If user is not set (e.g., page refresh), we should fetch from token or clear it
      if (!user) {
        // For now, redirect to login on refresh
        // In production, decode JWT or call /me endpoint
        setLoading(false);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await client.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser({ username });
    return true;
  };

  const register = async (username, password) => {
    await client.post('/auth/register', { username, password });
    return login(username, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const resp = await api.post(endpoint, { username, password });
      
      setToken(resp.data.access_token);
      
      // Fetch user profile immediately
      const userResp = await api.get('/users/me');
      setUser(userResp.data);
      
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="stars-background"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="login-card glass-panel"
      >
        <div className="brand">
          <h1 className="logo-text">KroGram</h1>
          <p className="subtitle">Connect. Chat. Create.</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.form 
            key={mode}
            initial={{ x: mode === 'login' ? -20 : 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: mode === 'login' ? 20 : -20, opacity: 0 }}
            onSubmit={handleSubmit}
            className="login-form"
          >
            <label>Username</label>
            <input 
              type="text" 
              placeholder="Enter username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input-glass"
            />

            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-glass"
            />
            
            <button disabled={loading} type="submit" className="btn-primary">
              {loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Create Account')}
            </button>

            <button 
              type="button" 
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }} 
              className="btn-link"
            >
              {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </motion.form>
        </AnimatePresence>

        {error && <p className="error-text">{error}</p>}
      </motion.div>
    </div>
  );
};

export default LoginPage;

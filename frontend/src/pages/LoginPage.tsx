import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import './LoginPage.css';

const LoginPage = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/request-code', { phone });
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/auth/verify-code', { phone, code });
      setToken(resp.data.access_token);
      
      const userResp = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${resp.data.access_token}` }
      });
      setUser(userResp.data);
      
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid code');
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
          {step === 'phone' ? (
            <motion.form 
              key="phone"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleRequestCode}
              className="login-form"
            >
              <label>Phone Number</label>
              <input 
                type="tel" 
                placeholder="+7 (999) 000-00-00" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="input-glass"
              />
              <button disabled={loading} type="submit" className="btn-primary">
                {loading ? 'Sending...' : 'Get Code'}
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="code"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleVerifyCode}
              className="login-form"
            >
              <label>Enter 6-digit Code</label>
              <input 
                type="text" 
                placeholder="123456" 
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="input-glass"
              />
              <p className="hint">Try '123456' for prototype</p>
              <button disabled={loading} type="submit" className="btn-primary">
                {loading ? 'Verifying...' : 'Login'}
              </button>
              <button type="button" onClick={() => setStep('phone')} className="btn-link">
                Change Number
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {error && <p className="error-text">{error}</p>}
      </motion.div>
    </div>
  );
};

export default LoginPage;

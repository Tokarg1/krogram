import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useChatStore } from '../../store/useChatStore';
import './Modal.css';

interface JoinServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JoinServerModal: React.FC<JoinServerModalProps> = ({ isOpen, onClose }) => {
  const [serverId, setServerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const addServer = useChatStore((state) => state.addServer);
  const setServers = useChatStore((state) => state.setServers);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await api.post(`/servers/${serverId}/join`);
      // Refresh server list
      const resp = await api.get('/servers/');
      setServers(resp.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Server not found or already joined');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="modal-content glass-panel"
          >
            <div className="modal-header">
              <h2>Join a Server</h2>
              <button onClick={onClose} className="close-btn"><X /></button>
            </div>
            
            <p className="modal-desc">
              Enter a server ID to join an existing community.
            </p>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>SERVER ID</label>
                <div className="input-with-icon">
                  <Search size={18} />
                  <input 
                    type="number" 
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    placeholder="Enter ID (e.g. 1)"
                    required
                  />
                </div>
              </div>

              {error && <p className="error-text">{error}</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn-secondary">Back</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Joining...' : 'Join Server'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default JoinServerModal;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Image as ImageIcon } from 'lucide-react';
import { api } from '../../services/api';
import { useChatStore } from '../../store/useChatStore';
import './Modal.css';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const addServer = useChatStore((state) => state.addServer);
  const setCurrentServer = useChatStore((state) => state.setCurrentServer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const resp = await api.post('/servers/', { name, icon_url: iconUrl });
      addServer(resp.data);
      setCurrentServer(resp.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create server');
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
              <h2>Create Your Server</h2>
              <button onClick={onClose} className="close-btn"><X /></button>
            </div>
            
            <p className="modal-desc">
              Your server is where you and your friends hang out. Make yours and start talking.
            </p>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>SERVER NAME</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome server"
                  required
                />
              </div>

              <div className="form-group">
                <label>ICON URL (OPTIONAL)</label>
                <div className="input-with-icon">
                  <ImageIcon size={18} />
                  <input 
                    type="url" 
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://example.com/icon.png"
                  />
                </div>
              </div>

              {error && <p className="error-text">{error}</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn-secondary">Back</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateServerModal;

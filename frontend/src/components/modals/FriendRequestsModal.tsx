import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, User } from 'lucide-react';
import { api } from '../../services/api';
import './Modal.css';

interface FriendRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccepted: (channelId: number) => void;
}

const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({ isOpen, onClose, onAccepted }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/friends/incoming');
      setRequests(resp.data);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchRequests();
  }, [isOpen]);

  const handleAccept = async (reqId: number) => {
    try {
      const resp = await api.post(`/friends/accept/${reqId}`);
      setRequests(prev => prev.filter(r => r.id !== reqId));
      onAccepted(resp.data.channel_id);
      alert('Request accepted!');
    } catch (err) {
      alert('Failed to accept request');
    }
  };

  const handleDecline = async (reqId: number) => {
    try {
      await api.post(`/friends/decline/${reqId}`);
      setRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      alert('Failed to decline request');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="modal-content glass-panel"
            style={{ maxWidth: '400px' }}
          >
            <div className="modal-header">
              <h2>Incoming Requests</h2>
              <button onClick={onClose} className="close-btn"><X /></button>
            </div>

            <div className="request-list scroller" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <p className="status-text">Loading...</p>
              ) : requests.length > 0 ? (
                requests.map(req => (
                  <div key={req.id} className="request-item result-item">
                    <div className="user-avatar"><User /></div>
                    <div className="user-info">
                       <span className="username">User ID: {req.sender_id}</span>
                       <span className="status">Wants to be your friend</span>
                    </div>
                    <div className="request-actions" style={{ display: 'flex', gap: '8px' }}>
                       <button onClick={() => handleAccept(req.id)} className="btn-icon circle-green"><Check size={18} /></button>
                       <button onClick={() => handleDecline(req.id)} className="btn-icon circle-red"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="status-text">No pending requests</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FriendRequestsModal;

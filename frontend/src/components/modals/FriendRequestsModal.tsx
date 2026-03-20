import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, User, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import './Modal.css';

interface FriendRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccepted: (channelId: number) => void;
}

interface FriendRequest {
  id: number;
  from_user_id: number;
  from_user?: {
    id: number;
    username: string;
    avatar_url?: string | null;
  };
}

const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({ isOpen, onClose, onAccepted }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/friends/incoming');
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchRequests();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }

    const channel = supabase
      .channel(`friend_requests_modal_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        (payload) => {
          const row = (payload.new || payload.old) as { to_phone?: string; from_user_id?: number; status?: string } | undefined;
          if (row?.to_phone === user.username || row?.from_user_id === user.id) {
            void fetchRequests();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isOpen, user?.id, user?.username]);

  const handleAccept = async (requestId: number) => {
    try {
      const response = await api.post(`/friends/accept/${requestId}`);
      setRequests((value) => value.filter((request) => request.id !== requestId));
      onAccepted(response.data.channel_id);
      onClose();
      alert('Request accepted');
    } catch (error) {
      alert('Failed to accept request');
      console.error(error);
    }
  };

  const handleDecline = async (requestId: number) => {
    try {
      await api.post(`/friends/decline/${requestId}`);
      setRequests((value) => value.filter((request) => request.id !== requestId));
    } catch (error) {
      alert('Failed to decline request');
      console.error(error);
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
            style={{ maxWidth: '420px' }}
          >
            <div className="modal-header">
              <h2>Incoming Requests</h2>
              <button onClick={onClose} className="close-btn">
                <X />
              </button>
            </div>

            <div className="request-list scroller" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {loading ? (
                <p className="status-text">Loading...</p>
              ) : requests.length > 0 ? (
                requests.map((request) => (
                  <div key={request.id} className="request-item result-item">
                    <div className="user-avatar">
                      {request.from_user?.username?.[0]?.toUpperCase() || <User size={18} />}
                    </div>
                    <div className="user-info">
                      <span className="username">{request.from_user?.username || `User ${request.from_user_id}`}</span>
                      <span className="status">Wants to open a DM with you</span>
                    </div>
                    <div className="request-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => void handleAccept(request.id)} className="btn-icon circle-green">
                        <Check size={18} />
                      </button>
                      <button onClick={() => void handleDecline(request.id)} className="btn-icon circle-red">
                        <Trash2 size={18} />
                      </button>
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

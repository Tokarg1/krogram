import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, UserPlus, X } from 'lucide-react';
import { api } from '../../services/api';
import './Modal.css';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchUser {
  id: number;
  username: string;
  avatar_url?: string | null;
  phone?: string | null;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
      setResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (userId: number) => {
    setRequestingId(userId);
    try {
      await api.post(`/friends/request/${userId}`);
      alert('Friend request sent');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to send request');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="modal-content glass-panel search-modal"
          >
            <div className="modal-header">
              <h2>Find Friends</h2>
              <button onClick={onClose} className="close-btn">
                <X />
              </button>
            </div>

            <form onSubmit={handleSearch} className="modal-form">
              <div className="form-group">
                <div className="input-with-icon">
                  <SearchIcon size={18} />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by username"
                    autoFocus
                  />
                </div>
              </div>
            </form>

            <div className="search-results scroller">
              {loading ? (
                <p className="status-text">Searching...</p>
              ) : results.length > 0 ? (
                results.map((user) => (
                  <div key={user.id} className="result-item">
                    <div className="user-avatar">{user.username[0]?.toUpperCase() || '?'}</div>
                    <div className="user-info">
                      <span className="username">{user.username}</span>
                      <span className="phone">{user.phone ? `Phone: ${user.phone}` : 'Send a request to open a DM'}</span>
                    </div>
                    <button
                      className="add-friend-btn"
                      onClick={() => void sendRequest(user.id)}
                      title="Send friend request"
                      disabled={requestingId === user.id}
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))
              ) : query && !loading ? (
                <p className="status-text">No users found</p>
              ) : (
                <p className="status-text">Search by username to add friends and open DMs</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UserSearchModal;

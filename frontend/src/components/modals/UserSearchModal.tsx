import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search as SearchIcon, UserPlus, Phone, User } from 'lucide-react';
import { api } from '../../services/api';
import './Modal.css';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    
    try {
      const resp = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
      setResults(resp.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (userId: number) => {
    try {
      await api.post(`/friends/request/${userId}`);
      alert('Friend request sent!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to send request');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="modal-content glass-panel search-modal"
          >
            <div className="modal-header">
              <h2>Find Friends</h2>
              <button onClick={onClose} className="close-btn"><X /></button>
            </div>

            <form onSubmit={handleSearch} className="modal-form">
              <div className="form-group">
                <div className="input-with-icon">
                  <SearchIcon size={18} />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by nickname... (e.g. KroGram)"
                    autoFocus
                  />
                </div>
              </div>
            </form>

            <div className="search-results scroller">
              {loading ? (
                <p className="status-text">Searching...</p>
              ) : results.length > 0 ? (
                results.map(user => (
                  <div key={user.id} className="result-item">
                    <div className="user-avatar">{user.username[0]}</div>
                    <div className="user-info">
                      <span className="username">{user.username}</span>
                      <span className="phone"><Phone size={12} /> {user.phone}</span>
                    </div>
                    <button 
                      className="add-friend-btn" 
                      onClick={() => sendRequest(user.id)}
                      title="Send Friend Request"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))
              ) : query && !loading ? (
                <p className="status-text">No users found</p>
              ) : (
                <p className="status-text">Enter nickname or phone to search</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UserSearchModal;

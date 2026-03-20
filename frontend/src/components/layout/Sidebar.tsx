import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../services/api';
import { 
  Home, Plus, Hash, Volume2, User, 
  Search, Settings, LogOut, ChevronRight, X,
  Globe
} from 'lucide-react';
import UserSearchModal from '../modals/UserSearchModal';
import FriendRequestsModal from '../modals/FriendRequestsModal';
import CreateServerModal from '../modals/CreateServerModal';
import JoinServerModal from '../modals/JoinServerModal';
import './Sidebar.css';

const Sidebar = () => {
  const { 
    servers, currentServer, currentChannel, 
    setCurrentServer, setCurrentChannel, dmChannels,
    isSidebarOpen, setIsSidebarOpen, setDmChannels
  } = useChatStore();
  const { user, logout } = useAuthStore();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const fetchDMs = async () => {
    try {
      const resp = await api.get('/friends/dms');
      setDmChannels(resp.data);
    } catch (err) {
      console.error('DM load failed:', err);
    }
  };

  useEffect(() => {
    fetchDMs();
  }, [setDmChannels]);

  const handleSelect = (callback: () => void) => {
    callback();
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  if (!isSidebarOpen) return null;

  return (
    <div className={`sidebar-container glass-panel ${isSidebarOpen ? 'open' : ''}`}>
      <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>
        <X size={24} />
      </button>

      <div className="servers-bar scroller">
        <div className="server-icon home" title="Direct Messages" onClick={() => handleSelect(() => setCurrentServer(null))}>
           <Home size={28} />
        </div>
        <div className="divider" />
        {servers.map((server) => (
          <div 
            key={server.id} 
            className={`server-icon ${currentServer?.id === server.id ? 'active' : ''}`}
            onClick={() => handleSelect(() => setCurrentServer(server))}
            title={server.name}
          >
            {server.icon_url ? (
              <img src={server.icon_url} alt={server.name} />
            ) : (
              server.name[0]
            )}
          </div>
        ))}
        <div className="divider" />
        <div className="server-icon action add" title="Create Server" onClick={() => setIsCreateOpen(true)}>
          <Plus size={28} />
        </div>
        <div className="server-icon action join" title="Join Server" onClick={() => setIsJoinOpen(true)}>
          <Globe size={24} />
        </div>
        <div className="server-icon action search" title="Search Users" onClick={() => setIsSearchOpen(true)}>
          <Search size={24} />
        </div>
      </div>

      <div className="channels-sidebar">
        <div className="sidebar-header">
          <h3>{currentServer ? currentServer.name : 'KroGram'}</h3>
        </div>

        <div className="channels-list scroller">
          {currentServer ? (
            currentServer.channels.map((channel) => (
              <div 
                key={channel.id} 
                className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => handleSelect(() => setCurrentChannel(channel))}
              >
                {channel.type === 'text' ? <Hash size={18} /> : <Volume2 size={18} />}
                <span>{channel.name}</span>
              </div>
            ))
          ) : (
            <>
              <div className="dm-section-header">
                <span>Direct Messages</span>
                <Plus size={16} className="add-dm-icon" title="New DM" onClick={() => setIsSearchOpen(true)} />
              </div>
              <div className="dm-requests-btn" onClick={() => setIsRequestsOpen(true)}>
                <span>Friend Requests</span>
              </div>
              {dmChannels.map((channel) => (
                <div 
                  key={channel.id} 
                  className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => handleSelect(() => setCurrentChannel(channel))}
                >
                  <User size={18} />
                  <span>{channel.name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="user-profile-panel glass-panel">
          <div className="user-info">
            <div className="circle-avatar">{user?.username?.[0]}</div>
            <div className="info-text">
              <span className="username">{user?.username}</span>
              <span className="status">Online</span>
            </div>
          </div>
          <div className="user-actions">
            <Settings size={18} className="action-icon" />
            <LogOut size={18} className="action-icon logout" onClick={logout} />
          </div>
        </div>
      </div>

      <UserSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <FriendRequestsModal 
        isOpen={isRequestsOpen} 
        onClose={() => setIsRequestsOpen(false)} 
        onAccepted={() => fetchDMs()} 
      />
      <CreateServerModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <JoinServerModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
};

export default Sidebar;

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore, Message } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { callService } from '../../services/callService';
import { Hash, Volume2, Send, Paperclip, Users, Menu, Trash2, Smile, Phone } from 'lucide-react';
import VoiceStub from './VoiceStub';
import MediaInput from './MediaInput';
import './ChatWindow.css';

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '❤️', '👏', '🤔', '😢', '🙌', '✨', '🎉', '✅', '❌', '😱'];

const STICKERS = [
  { id: 's1', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41YmxS7pP4jG6Xvy/giphy.webp' },
  { id: 's2', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKMGpxP6tT9dZ0k/giphy.webp' },
  { id: 's3', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41lO7Xb8Q0k1g500/giphy.webp' },
  { id: 's4', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKVUn7iM8FMEU24/giphy.webp' },
  { id: 's5', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41lUjJ6fV9M0M4N2/giphy.webp' },
  { id: 's6', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKRno7l4IomTAsU/giphy.webp' }
];

const ChatWindow = () => {
  const { currentChannel, messages, setMessages, removeMessage, isConnected, isSidebarOpen, setIsSidebarOpen } = useChatStore();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentChannel) return;

    const fetchHistory = async () => {
      try {
        const resp = await api.get(`/messages/${currentChannel.id}`);
        setMessages(resp.data);
      } catch (err) {
        console.error('History load failed:', err);
      }
    };

    fetchHistory();
    socketService.joinChannel(currentChannel.id);
  }, [currentChannel, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !currentChannel) return;

    socketService.sendMessage(currentChannel.id, inputText);
    setInputText('');
  };

  const handleStickerSend = (stickerUrl: string) => {
    if (!currentChannel) return;
    socketService.sendMessage(currentChannel.id, '', stickerUrl, 'image');
    setShowStickers(false);
  };

  const deleteMsg = async (mid: number) => {
    try {
      await api.delete(`/messages/${mid}`);
      removeMessage(mid);
    } catch (err) {
      alert('Failed to delete message');
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  if (!currentChannel) {
    return (
      <div className="chat-placeholder">
        <button className="mobile-menu-btn float" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={24} /></button>
        <h2 className="logo-text">KroGram</h2>
        <p>Select a channel or server to start chatting</p>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="header-info">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={24} /></button>
          {currentChannel.type === 'text' ? <Hash size={20} /> : <Volume2 size={20} />}
          <h3>{currentChannel.name}</h3>
          {!isConnected && <span className="status-badge connecting">Connecting...</span>}
          {isConnected && <span className="status-badge online">Connected</span>}
        </div>
        <div className="header-actions">
           <Users size={20} className="action-icon" />
        </div>
      </div>

      <div className="chat-content">
        {currentChannel.type === 'text' ? (
          <>
            <div className="message-list scroller" ref={scrollRef}>
              {messages.map((msg) => (
                <div key={msg.id} className="message-item">
                  <div className="avatar">{msg.sender.username?.[0] || '?'}</div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-author">{msg.sender.username}</span>
                      {msg.sender_id !== user?.id && (
                        <Phone 
                          size={14} 
                          onClick={() => callService.initiateCall(msg.sender_id, msg.sender.username)} 
                          style={{ cursor: 'pointer', marginLeft: '6px', opacity: 0.7 }}
                        />
                      )}
                      <span className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      {msg.sender_id === user?.id && (
                        <Trash2 
                          size={14} 
                          className="delete-msg-icon" 
                          onClick={() => deleteMsg(msg.id)} 
                        />
                      )}
                    </div>

                    {msg.media_type === 'text' && <p>{msg.content}</p>}

                    {msg.media_type === 'image' && msg.media_url && (
                      <img src={msg.media_url} alt="Media" className={msg.media_url.includes('giphy') ? 'sticker-img' : 'message-image'} />
                    )}

                    {msg.media_type === 'video' && msg.media_url && (
                      <video src={msg.media_url} controls className="message-video" />
                    )}

                    {msg.media_type === 'circle' && msg.media_url && (
                      <div className="video-circle-container">
                        <video src={msg.media_url} autoPlay muted playsInline className="video-circle" onClick={(e) => {
                             const v = e.currentTarget;
                             if (v.paused) { v.play(); v.muted = false; v.currentTime = 0; } else { v.pause(); }
                          }}
                        />
                        <div className="video-overlay-hint">Click for Sound</div>
                      </div>
                    )}

                    {msg.media_type === 'file' && msg.media_url && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className="message-file">
                        <Paperclip size={16} /> Download File
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="message-input-form">
              {showStickers && (
                <div className="sticker-panel glass-panel animate-slide-up">
                   <div className="sticker-grid">
                      {STICKERS.map(s => (
                        <img key={s.id} src={s.url} onClick={() => handleStickerSend(s.url)} className="sticker-option" alt="Sticker" />
                      ))}
                   </div>
                </div>
              )}
              <div className="emoji-bar">
                 {EMOJIS.map(e => (
                   <span key={e} onClick={() => addEmoji(e)} className="emoji-item">{e}</span>
                 ))}
              </div>
              <div className="input-wrapper glass-panel">
                <MediaInput channelId={currentChannel.id} />
                <button className="sticker-toggle-btn" onClick={() => setShowStickers(!showStickers)} title="Stickers">
                   <Smile size={20} color={showStickers ? '#5865f2' : 'currentColor'} />
                </button>
                <input
                  type="text"
                  placeholder={isConnected ? `Message #${currentChannel.name}` : "Connecting to server..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  className="chat-input"
                  disabled={!isConnected}
                  autoFocus
                />
                <button 
                  onClick={() => handleSend()} 
                  className="send-btn" 
                  disabled={!inputText.trim() || !isConnected}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <VoiceStub channel={currentChannel} />
        )}
      </div>
    </div>
  );
};

export default ChatWindow;

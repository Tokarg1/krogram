import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { callService } from '../../services/callService';
import { Hash, Menu, Paperclip, Phone, Send, Smile, Users, Video, Volume2, Trash2 } from 'lucide-react';
import VoiceStub from './VoiceStub';
import MediaInput from './MediaInput';
import './ChatWindow.css';

const EMOJIS = ['\u{1F602}', '\u{1F44D}', '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F44F}', '\u{1F914}', '\u{1F389}', '\u{2728}', '\u{1F62D}', '\u{1F631}'];

const STICKERS = [
  { id: 's1', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41YmxS7pP4jG6Xvy/giphy.webp' },
  { id: 's2', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKMGpxP6tT9dZ0k/giphy.webp' },
  { id: 's3', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41lO7Xb8Q0k1g500/giphy.webp' },
  { id: 's4', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKVUn7iM8FMEU24/giphy.webp' },
  { id: 's5', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41lUjJ6fV9M0M4N2/giphy.webp' },
  { id: 's6', url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHN6cm5scXRxbmRyOHRyazZ0Y3Y1eDNyeHl4eDNyeHl4eDRyeHl4eDNyeHl4eDNyeHl4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKRno7l4IomTAsU/giphy.webp' },
];

const formatMessageTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const ChatWindow = () => {
  const { currentChannel, messages, setMessages, removeMessage, isConnected, isSidebarOpen, setIsSidebarOpen } = useChatStore();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentChannel) {
      return;
    }

    const fetchHistory = async () => {
      try {
        const response = await api.get(`/messages/${currentChannel.id}`);
        setMessages(response.data);
      } catch (error) {
        console.error('History load failed:', error);
      }
    };

    void fetchHistory();
    socketService.joinChannel(currentChannel.id);
  }, [currentChannel, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!inputText.trim() || !currentChannel || sending) {
      return;
    }

    setSending(true);
    try {
      await socketService.sendMessage(currentChannel.id, inputText.trim());
      setInputText('');
    } catch (error) {
      alert('Failed to send message');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleStickerSend = async (stickerUrl: string) => {
    if (!currentChannel) {
      return;
    }

    try {
      await socketService.sendMessage(currentChannel.id, '', stickerUrl, 'image');
      setShowStickers(false);
    } catch (error) {
      alert('Failed to send sticker');
      console.error(error);
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/messages/${messageId}`);
      removeMessage(messageId);
    } catch (error) {
      alert('Failed to delete message');
      console.error(error);
    }
  };

  if (!currentChannel) {
    return (
      <div className="chat-placeholder">
        <button className="mobile-menu-btn float" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <Menu size={24} />
        </button>
        <h2 className="logo-text">KroGram</h2>
        <p>Select a channel or DM to start chatting</p>
      </div>
    );
  }

  const isDirectMessage = Boolean(currentChannel.is_dm && currentChannel.peer);
  const channelTitle = isDirectMessage ? currentChannel.peer?.username || currentChannel.name : currentChannel.name;

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="header-info">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          {currentChannel.type === 'text' ? <Hash size={20} /> : <Volume2 size={20} />}
          <h3>{channelTitle}</h3>
          {!isConnected && <span className="status-badge connecting">Connecting...</span>}
          {isConnected && <span className="status-badge online">Connected</span>}
        </div>

        <div className="header-actions">
          {isDirectMessage ? (
            <>
              <button
                className="header-action-btn"
                title="Start audio call"
                onClick={() => currentChannel.peer && void callService.initiateCall(currentChannel.peer.id, currentChannel.peer.username, 'audio')}
              >
                <Phone size={18} />
              </button>
              <button
                className="header-action-btn"
                title="Start video call"
                onClick={() => currentChannel.peer && void callService.initiateVideoCall(currentChannel.peer.id, currentChannel.peer.username)}
              >
                <Video size={18} />
              </button>
            </>
          ) : (
            <Users size={20} className="action-icon" />
          )}
        </div>
      </div>

      <div className="chat-content">
        {currentChannel.type === 'text' ? (
          <>
            <div className="message-list scroller" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="empty-chat-state">
                  <h4>{isDirectMessage ? `Say hi to ${channelTitle}` : `Welcome to #${channelTitle}`}</h4>
                  <p>Messages, voice notes, files, circles, and calls will show up here.</p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className="message-item">
                  <div className="avatar">{message.sender.username?.[0] || '?'}</div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-author">{message.sender.username}</span>
                      <span className="message-time">{formatMessageTime(message.created_at)}</span>
                      {message.sender_id === user?.id && (
                        <Trash2 size={14} className="delete-msg-icon" onClick={() => void deleteMessage(message.id)} />
                      )}
                    </div>

                    {message.media_type === 'text' && <p>{message.content}</p>}

                    {message.media_type === 'image' && message.media_url && (
                      <img src={message.media_url} alt={message.content || 'Image attachment'} className={message.media_url.includes('giphy') ? 'sticker-img' : 'message-image'} />
                    )}

                    {message.media_type === 'video' && message.media_url && <video src={message.media_url} controls playsInline className="message-video" />}

                    {message.media_type === 'voice' && message.media_url && (
                      <audio src={message.media_url} controls preload="metadata" className="message-audio" />
                    )}

                    {message.media_type === 'circle' && message.media_url && (
                      <div className="video-circle-container">
                        <video
                          src={message.media_url}
                          autoPlay
                          muted
                          playsInline
                          loop
                          className="video-circle"
                          onClick={(event) => {
                            const video = event.currentTarget;
                            if (video.paused) {
                              void video.play();
                              video.muted = false;
                              video.currentTime = 0;
                            } else {
                              video.pause();
                            }
                          }}
                        />
                        <div className="video-overlay-hint">Tap for sound</div>
                      </div>
                    )}

                    {message.media_type === 'file' && message.media_url && (
                      <a href={message.media_url} target="_blank" rel="noreferrer" className="message-file" download={message.content || undefined}>
                        <Paperclip size={16} /> {message.content || 'Download file'}
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
                    {STICKERS.map((sticker) => (
                      <img key={sticker.id} src={sticker.url} onClick={() => void handleStickerSend(sticker.url)} className="sticker-option" alt="Sticker" />
                    ))}
                  </div>
                </div>
              )}

              <div className="emoji-bar">
                {EMOJIS.map((emoji) => (
                  <span key={emoji} onClick={() => setInputText((value) => value + emoji)} className="emoji-item">
                    {emoji}
                  </span>
                ))}
              </div>

              <form className="input-wrapper glass-panel" onSubmit={handleSend}>
                <MediaInput channelId={currentChannel.id} />
                <button type="button" className="sticker-toggle-btn" onClick={() => setShowStickers((visible) => !visible)} title="Stickers">
                  <Smile size={20} color={showStickers ? '#5865f2' : 'currentColor'} />
                </button>
                <input
                  type="text"
                  placeholder={isConnected ? (isDirectMessage ? `Message ${channelTitle}` : `Message #${channelTitle}`) : 'Connecting to server...'}
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="chat-input"
                  disabled={!isConnected || sending}
                  autoFocus
                />
                <button type="submit" className="send-btn" disabled={!inputText.trim() || !isConnected || sending}>
                  <Send size={18} />
                </button>
              </form>
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

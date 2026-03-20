import React, { useState } from 'react';
import { Volume2, Mic, Settings, LogOut, PhoneOff } from 'lucide-react';
import { useChatStore, Channel } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { socketService } from '../../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import './VoiceStub.css';

const VoiceStub = ({ channel }: { channel: Channel }) => {
  const { voiceParticipants } = useChatStore();
  const { user } = useAuthStore();
  const [inChannel, setInChannel] = useState(false);

  const channelUsers = voiceParticipants[channel.id] || [];
  // For the stub, if we joined, we are in the list. 
  // Normally the list comes from the server.
  const isMeIn = inChannel;

  const handleToggle = () => {
    if (inChannel) {
      socketService.updateVoiceStatus(channel.id, 'leave');
    } else {
      socketService.updateVoiceStatus(channel.id, 'join');
    }
    setInChannel(!inChannel);
  };

  return (
    <div className="voice-container">
      <div className="voice-header glass-panel">
        <Volume2 size={48} className="voice-icon" />
        <h2>{channel.name}</h2>
        <p>{channelUsers.length} users active</p>
      </div>

      <div className="voice-participants scroller">
         <AnimatePresence>
          {channelUsers.map(uid => (
            <motion.div 
              key={uid}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="participant-card"
            >
              <div className="avatar-large">{uid === user!.id ? user!.username[0] : 'U'}</div>
              <span>{uid === user!.id ? user!.username : `User ${uid}`}</span>
            </motion.div>
          ))}
          {channelUsers.length === 0 && !isMeIn && <p className="empty-msg">No one is here yet. Be the first!</p>}
         </AnimatePresence>
      </div>

      <div className="voice-footer glass-panel">
        <div className="device-status">
          <button className="status-btn"><Mic size={20}/></button>
          <button className="status-btn"><Settings size={20}/></button>
        </div>
        
        <button 
          onClick={handleToggle} 
          className={`join-btn ${inChannel ? 'btn-red' : 'btn-green'}`}
        >
          {inChannel ? <PhoneOff size={24}/> : <PhoneOff size={24} style={{ transform: 'rotate(135deg)' }} />}
          {inChannel ? 'Disconnect' : 'Join Voice'}
        </button>
      </div>
    </div>
  );
};

export default VoiceStub;

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import { callService } from '../../services/callService';
import './ActiveCall.css';

const ActiveCall = () => {
  const { isActive, isReceiving, isCalling, remoteUsername, remoteUserId, remoteStream, isMuted, toggleMute } = useCallStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play incoming remote audio automatically
  useEffect(() => {
    if (remoteStream && audioRef.current) {
        audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!isActive && !isReceiving && !isCalling) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="call-overlay glass-panel"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
      >
        <div className="call-info">
            <div className="call-avatar breathing-glow">
                <User size={32} />
            </div>
            <div className="call-text">
                <h3>{remoteUsername}</h3>
                <p>
                    {isCalling && 'Calling...'}
                    {isReceiving && 'Incoming Call...'}
                    {isActive && 'Call Connected - 00:00'}
                </p>
            </div>
        </div>
        
        <div className="call-actions">
            {isReceiving && !isActive && (
                <>
                    <button className="btn-call accept" onClick={() => remoteUserId && callService.answerCall(remoteUserId)}>
                        <Phone size={20} />
                    </button>
                    <button className="btn-call reject" onClick={() => remoteUserId && callService.rejectCall(remoteUserId)}>
                        <PhoneOff size={20} />
                    </button>
                </>
            )}

            {(isCalling || isActive) && (
                <>
                    <button className={`btn-call mute ${isMuted ? 'muted' : ''}`} onClick={toggleMute}>
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button className="btn-call end" onClick={() => callService.endActiveCall()}>
                        <PhoneOff size={20} />
                    </button>
                </>
            )}
        </div>
        
        {/* Invisible audio element to play the WebRTC remote peer's voice */}
        <audio ref={audioRef} autoPlay />
      </motion.div>
    </AnimatePresence>
  );
};

export default ActiveCall;

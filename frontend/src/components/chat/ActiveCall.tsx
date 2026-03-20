import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import { callService } from '../../services/callService';
import './ActiveCall.css';

const ActiveCall = () => {
  const { isActive, isReceiving, isCalling, remoteUsername, remoteUserId, remoteStream, isMuted, startedAt, toggleMute } = useCallStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  // Play incoming remote audio automatically
  useEffect(() => {
    if (!audioRef.current) return;

    if (remoteStream) {
        audioRef.current.srcObject = remoteStream;
        void audioRef.current.play().catch(() => {
          // Browser autoplay policies can still block playback until the user interacts.
        });
    } else {
        audioRef.current.srcObject = null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!isActive || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(intervalId);
  }, [isActive, startedAt]);

  if (!isActive && !isReceiving && !isCalling) return null;

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');

  let statusText = 'Calling...';
  if (isReceiving) statusText = 'Incoming call...';
  if (isActive) statusText = `Call connected - ${minutes}:${seconds}`;

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
                <p>{statusText}</p>
            </div>
        </div>
        
        <div className="call-actions">
            {isReceiving && !isActive && (
                <>
                    <button className="btn-call accept" onClick={() => remoteUserId && void callService.answerCall(remoteUserId)}>
                        <Phone size={20} />
                    </button>
                    <button className="btn-call reject" onClick={() => remoteUserId && void callService.rejectCall(remoteUserId)}>
                        <PhoneOff size={20} />
                    </button>
                </>
            )}

            {(isCalling || isActive) && (
                <>
                    <button className={`btn-call mute ${isMuted ? 'muted' : ''}`} onClick={toggleMute}>
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button className="btn-call end" onClick={() => void callService.endActiveCall()}>
                        <PhoneOff size={20} />
                    </button>
                </>
            )}
        </div>
        
        {/* Invisible audio element to play the WebRTC remote peer's voice */}
        <audio ref={audioRef} autoPlay playsInline />
      </motion.div>
    </AnimatePresence>
  );
};

export default ActiveCall;

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, User, Video } from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import { callService } from '../../services/callService';
import './ActiveCall.css';

const ActiveCall = () => {
  const {
    isActive,
    isReceiving,
    isCalling,
    remoteUsername,
    remoteUserId,
    localStream,
    remoteStream,
    isMuted,
    isCameraEnabled,
    callType,
    startedAt,
    toggleMute,
    toggleCamera,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = callType === 'video' ? localStream : null;
    }
  }, [callType, localStream]);

  useEffect(() => {
    if (callType === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        if (remoteStream) {
          void remoteVideoRef.current.play().catch(() => {});
        }
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      return;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      if (remoteStream) {
        void remoteAudioRef.current.play().catch(() => {});
      }
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [callType, remoteStream]);

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

  if (!isActive && !isReceiving && !isCalling) {
    return null;
  }

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  const isVideoCall = callType === 'video';

  let statusText = 'Calling...';
  if (isReceiving) {
    statusText = isVideoCall ? 'Incoming video call...' : 'Incoming audio call...';
  } else if (isCalling) {
    statusText = isVideoCall ? 'Starting video call...' : 'Starting audio call...';
  } else if (isActive) {
    statusText = `${isVideoCall ? 'Video call' : 'Audio call'} connected - ${minutes}:${seconds}`;
  }

  return (
    <AnimatePresence>
      <motion.div
        className={`call-overlay glass-panel ${isVideoCall ? 'video-call' : 'audio-call'}`}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -30, opacity: 0 }}
      >
        <div className="call-info">
          <div className="call-avatar breathing-glow">
            {isVideoCall ? <Video size={28} /> : <User size={28} />}
          </div>
          <div className="call-text">
            <h3>{remoteUsername}</h3>
            <p>{statusText}</p>
          </div>
        </div>

        {isVideoCall && (
          <div className="call-video-stage">
            <div className="remote-video-shell">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              ) : (
                <div className="video-placeholder">
                  <User size={48} />
                  <span>Waiting for camera...</span>
                </div>
              )}
            </div>

            <div className={`local-video-shell ${isCameraEnabled ? '' : 'camera-off'}`}>
              {localStream && localStream.getVideoTracks().length > 0 ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
              ) : (
                <div className="video-placeholder compact">
                  <CameraOff size={24} />
                </div>
              )}
              {!isCameraEnabled && <div className="video-muted-badge">Camera off</div>}
            </div>
          </div>
        )}

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
              {isVideoCall && (
                <button className={`btn-call mute ${isCameraEnabled ? '' : 'muted'}`} onClick={toggleCamera}>
                  {isCameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
                </button>
              )}
              <button className="btn-call end" onClick={() => void callService.endActiveCall()}>
                <PhoneOff size={20} />
              </button>
            </>
          )}
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline />
      </motion.div>
    </AnimatePresence>
  );
};

export default ActiveCall;

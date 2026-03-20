import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Paperclip, RefreshCcw, Send, Square, Video, X } from 'lucide-react';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import './MediaInput.css';

interface MediaInputProps {
  channelId: number;
}

type RecordingMode = 'circle' | 'voice';

const VIDEO_LIMIT_SECONDS = 30;
const VOICE_LIMIT_SECONDS = 120;

const getSupportedMimeType = (candidates: string[]) => candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';

const MediaInput: React.FC<MediaInputProps> = ({ channelId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<RecordingMode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordingBlob(null);
    setPreviewType(null);
  };

  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const stopRecording = () => {
    clearTimers();
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const startRecording = async (mode: RecordingMode, nextFacingMode = facingMode) => {
    try {
      clearTimers();
      stopStream();
      clearPreview();

      const wantsVideo = mode === 'circle';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo
          ? {
              width: { ideal: 480 },
              height: { ideal: 480 },
              facingMode: nextFacingMode,
            }
          : false,
      });

      const mimeType = wantsVideo
        ? getSupportedMimeType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
        : getSupportedMimeType(['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']);

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || (wantsVideo ? 'video/webm' : 'audio/webm') });
        const nextPreviewUrl = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setPreviewUrl(nextPreviewUrl);
        setPreviewType(mode);
        setRecordingMode(null);
        setRecordingSeconds(0);
        stopStream();
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingMode(mode);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (wantsVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);

      autoStopRef.current = window.setTimeout(
        stopRecording,
        (wantsVideo ? VIDEO_LIMIT_SECONDS : VOICE_LIMIT_SECONDS) * 1000
      );

      recorder.start(250);
    } catch (error) {
      console.error('Recording failed:', error);
      alert(mode === 'circle' ? 'Camera or microphone access denied' : 'Microphone access denied');
      stopStream();
      clearTimers();
      setIsRecording(false);
      setRecordingMode(null);
      setRecordingSeconds(0);
    }
  };

  const restartCircleRecordingWithNewCamera = () => {
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacingMode);

    if (!isRecording || recordingMode !== 'circle') {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    clearTimers();
    stopStream();
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordingBlob(null);
    setPreviewType(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    void startRecording('circle', nextFacingMode);
  };

  const sendMedia = async (type: 'video' | 'circle' | 'voice' | 'image' | 'file', fileOrBlob: Blob | File, filename?: string) => {
    if (!fileOrBlob) {
      return;
    }

    setUploading(true);
    const formData = new FormData();
    const resolvedFilename =
      filename ||
      (fileOrBlob instanceof File && fileOrBlob.name) ||
      (type === 'circle' ? 'video-circle.webm' : type === 'voice' ? 'voice-message.webm' : 'attachment.bin');

    formData.append('file', fileOrBlob, resolvedFilename);

    try {
      const response = await api.post('/media/upload', formData);
      const messageContent = type === 'file' ? resolvedFilename : '';
      await socketService.sendMessage(channelId, messageContent, response.data.url, type);
      clearPreview();
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    let type: 'image' | 'video' | 'voice' | 'file' = 'file';
    if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    } else if (file.type.startsWith('audio/')) {
      type = 'voice';
    }

    await sendMedia(type, file, file.name);
    event.target.value = '';
  };

  const minutes = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
  const seconds = String(recordingSeconds % 60).padStart(2, '0');

  return (
    <div className="media-input-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
      />

      <button type="button" className="media-btn" onClick={() => fileInputRef.current?.click()} title="Send file, image, or video">
        <Paperclip size={20} />
      </button>

      <button
        type="button"
        className={`media-btn circular-btn ${isRecording && recordingMode === 'voice' ? 'recording' : ''}`}
        onClick={() => (isRecording && recordingMode === 'voice' ? stopRecording() : void startRecording('voice'))}
        title="Record voice message"
      >
        {isRecording && recordingMode === 'voice' ? <Square size={20} fill="white" /> : <Mic size={20} />}
      </button>

      <button
        type="button"
        className={`media-btn circular-btn ${isRecording && recordingMode === 'circle' ? 'recording' : ''}`}
        onClick={() => (isRecording && recordingMode === 'circle' ? stopRecording() : void startRecording('circle'))}
        title="Record video circle"
      >
        {isRecording && recordingMode === 'circle' ? <Square size={20} fill="white" /> : <Video size={20} />}
      </button>

      <AnimatePresence>
        {isRecording && recordingMode === 'circle' && (
          <motion.div className="recording-overlay" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <video ref={videoRef} autoPlay muted playsInline className="circle-preview" />
            <div className="recording-status">Recording circle {minutes}:{seconds}</div>
            <button type="button" className="flip-camera-btn" onClick={restartCircleRecordingWithNewCamera}>
              <RefreshCcw size={22} />
            </button>
            <div className="timer-dot" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecording && recordingMode === 'voice' && (
          <motion.div className="voice-recording-overlay glass-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <div className="voice-recording-pulse">
              <Mic size={20} />
            </div>
            <div className="voice-recording-meta">
              <strong>Recording voice</strong>
              <span>
                {minutes}:{seconds}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewUrl && previewType === 'circle' && (
          <motion.div className="preview-modal glass-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <video src={previewUrl} controls playsInline className="circle-preview-final" />
            <div className="preview-actions">
              <button type="button" onClick={clearPreview} className="btn-icon circle-red">
                <X />
              </button>
              <button type="button" onClick={() => recordingBlob && void sendMedia('circle', recordingBlob)} disabled={uploading} className="btn-icon circle-green">
                {uploading ? '...' : <Send />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewUrl && previewType === 'voice' && (
          <motion.div className="preview-modal glass-panel audio-preview-modal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <audio src={previewUrl} controls preload="metadata" className="voice-preview-player" />
            <div className="preview-actions">
              <button type="button" onClick={clearPreview} className="btn-icon circle-red">
                <X />
              </button>
              <button type="button" onClick={() => recordingBlob && void sendMedia('voice', recordingBlob)} disabled={uploading} className="btn-icon circle-green">
                {uploading ? '...' : <Send />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MediaInput;

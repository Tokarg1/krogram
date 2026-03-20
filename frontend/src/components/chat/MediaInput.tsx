import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, Play, Square, Video, Send, X, RefreshCcw } from 'lucide-react';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import './MediaInput.css';

interface MediaInputProps {
  channelId: number;
}

const MediaInput: React.FC<MediaInputProps> = ({ channelId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 480 }, 
          height: { ideal: 480 }, 
          facingMode: facingMode 
        }, 
        audio: true 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordingBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording failed:', err);
      alert('Camera access denied or device not found');
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    if (isRecording) {
      // Re-start recording with the new camera
      startRecording();
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendMedia = async (type: 'video' | 'circle' | 'image' | 'file', fileOrBlob: any) => {
    if (!fileOrBlob) return;
    setUploading(true);
    
    const formData = new FormData();
    // Correctly handle original file extensions
    const filename = fileOrBlob.name || (type === 'circle' ? 'circle.webm' : 'media.bin');
    formData.append('file', fileOrBlob, filename);
    
    try {
      const resp = await api.post('/media/upload', formData);
      socketService.sendMessage(channelId, '', resp.data.url, type);
      setPreviewUrl(null);
      setRecordingBlob(null);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Possible file size limit.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let type: 'image' | 'video' | 'file' = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      
      sendMedia(type, file);
    }
  };

  return (
    <div className="media-input-container">
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange}
        accept="image/*,video/*,.pdf,.doc,.docx"
      />
      
      <button className="media-btn" onClick={() => fileInputRef.current?.click()} title="Send File or Photo">
        <Paperclip size={20} />
      </button>

      <button 
        className={`media-btn circular-btn ${isRecording ? 'recording' : ''}`} 
        onClick={isRecording ? stopRecording : startRecording}
        title="Record Video Circle"
      >
        {isRecording ? <Square size={20} fill="white" /> : <Video size={20} />}
      </button>

      <AnimatePresence>
        {isRecording && (
          <div className="recording-overlay">
            <video ref={videoRef} autoPlay muted playsInline className="circle-preview" />
            <div className="recording-status">Recording Circle...</div>
            <button className="flip-camera-btn" onClick={toggleCamera}>
               <RefreshCcw size={24} />
            </button>
            <div className="timer-dot" />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewUrl && (
          <div className="preview-modal glass-panel">
            <video src={previewUrl} controls className="circle-preview-final" />
            <div className="preview-actions">
              <button onClick={() => { setPreviewUrl(null); setRecordingBlob(null); }} className="btn-icon circle-red"><X /></button>
              <button 
                onClick={() => sendMedia('circle', recordingBlob!)} 
                disabled={uploading}
                className="btn-icon circle-green"
              >
                {uploading ? "..." : <Send />}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MediaInput;

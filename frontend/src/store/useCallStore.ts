import { create } from 'zustand';

interface CallState {
  isActive: boolean;
  isReceiving: boolean;
  isCalling: boolean;
  remoteUserId: number | null;
  remoteUsername: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMuted: boolean;
  startedAt: number | null;
  
  startCall: (userId: number, username: string) => void;
  receiveCall: (userId: number, username: string) => void;
  acceptCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
  isInCall: () => boolean;
}

export const useCallStore = create<CallState>((set) => ({
  isActive: false,
  isReceiving: false,
  isCalling: false,
  remoteUserId: null,
  remoteUsername: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  startedAt: null,

  startCall: (userId, username) => set({
    isCalling: true,
    isReceiving: false,
    isActive: false,
    remoteUserId: userId,
    remoteUsername: username,
    startedAt: null,
  }),
  
  receiveCall: (userId, username) => set({
    isActive: false,
    isCalling: false,
    isReceiving: true,
    remoteUserId: userId,
    remoteUsername: username,
    startedAt: null,
  }),

  acceptCall: () => set({
    isCalling: false,
    isReceiving: false,
    isActive: true,
    startedAt: Date.now(),
  }),

  endCall: () => set({
    isActive: false,
    isReceiving: false,
    isCalling: false,
    remoteUserId: null,
    remoteUsername: null,
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    isMuted: false,
    startedAt: null,
  }),
  
  toggleMute: () => set((state) => {
    if (state.localStream) {
        state.localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
    }
    return { isMuted: !state.isMuted };
  }),
  
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  isInCall: () => {
    const state = useCallStore.getState();
    return state.isActive || state.isCalling || state.isReceiving;
  },
}));

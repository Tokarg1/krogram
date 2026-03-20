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
  
  startCall: (userId: number, username: string) => void;
  receiveCall: (userId: number, username: string, signalData: any) => void;
  acceptCall: () => void;
  endCall: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
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

  startCall: (userId, username) => set({
    isCalling: true,
    remoteUserId: userId,
    remoteUsername: username,
  }),
  
  receiveCall: (userId, username) => set({
    isReceiving: true,
    remoteUserId: userId,
    remoteUsername: username,
  }),

  acceptCall: () => set({
    isReceiving: false,
    isActive: true,
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
  }),
  
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
}));

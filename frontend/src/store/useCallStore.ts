import { create } from 'zustand';

export type CallType = 'audio' | 'video';

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
  isCameraEnabled: boolean;
  callType: CallType | null;
  startedAt: number | null;

  startCall: (userId: number, username: string, callType: CallType) => void;
  receiveCall: (userId: number, username: string, callType: CallType) => void;
  acceptCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
  setCameraEnabled: (enabled: boolean) => void;
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
  isCameraEnabled: false,
  callType: null,
  startedAt: null,

  startCall: (userId, username, callType) =>
    set({
      isCalling: true,
      isReceiving: false,
      isActive: false,
      remoteUserId: userId,
      remoteUsername: username,
      callType,
      isCameraEnabled: callType === 'video',
      startedAt: null,
    }),

  receiveCall: (userId, username, callType) =>
    set({
      isActive: false,
      isCalling: false,
      isReceiving: true,
      remoteUserId: userId,
      remoteUsername: username,
      callType,
      isCameraEnabled: false,
      startedAt: null,
    }),

  acceptCall: () =>
    set((state) => ({
      isCalling: false,
      isReceiving: false,
      isActive: true,
      isCameraEnabled:
        state.callType === 'video' && Boolean(state.localStream?.getVideoTracks().some((track) => track.enabled)),
      startedAt: Date.now(),
    })),

  endCall: () =>
    set({
      isActive: false,
      isReceiving: false,
      isCalling: false,
      remoteUserId: null,
      remoteUsername: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isCameraEnabled: false,
      callType: null,
      startedAt: null,
    }),

  toggleMute: () =>
    set((state) => {
      state.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });

      return { isMuted: !state.isMuted };
    }),

  toggleCamera: () =>
    set((state) => {
      const videoTracks = state.localStream?.getVideoTracks() || [];
      if (videoTracks.length === 0) {
        return state;
      }

      const nextEnabled = !videoTracks.every((track) => track.enabled);
      videoTracks.forEach((track) => {
        track.enabled = nextEnabled;
      });

      return { isCameraEnabled: nextEnabled };
    }),

  setLocalStream: (stream) =>
    set({
      localStream: stream,
      isCameraEnabled: Boolean(stream?.getVideoTracks().some((track) => track.enabled)),
      isMuted: Boolean(stream?.getAudioTracks().every((track) => !track.enabled)),
    }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  setCameraEnabled: (enabled) => set({ isCameraEnabled: enabled }),

  isInCall: () => {
    const state = useCallStore.getState();
    return state.isActive || state.isCalling || state.isReceiving;
  },
}));

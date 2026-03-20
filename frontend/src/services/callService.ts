import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';
import { CallType, useCallStore } from '../store/useCallStore';

type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'busy' | 'end_call';

interface SessionSignal {
  callType?: CallType;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

class CallService {
  private channel: any = null;
  private signalingReady: Promise<void> | null = null;
  private resolveSignalingReady: (() => void) | null = null;
  private rejectSignalingReady: ((reason?: unknown) => void) | null = null;
  private isSubscribed = false;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  };

  initializeSignaling() {
    const user = useAuthStore.getState().user;
    if (!user) {
      return;
    }

    this.teardownSignaling();

    console.log('[WebRTC] Joining global signaling channel');
    this.signalingReady = new Promise<void>((resolve, reject) => {
      this.resolveSignalingReady = resolve;
      this.rejectSignalingReady = reject;
    });
    void this.signalingReady.catch(() => {});

    this.channel = supabase.channel('calls_global', {
      config: { broadcast: { ack: true } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, async (payload: any) => {
        const { targetId, senderId, senderName, type, data } = payload.payload;

        if (targetId !== user.id) {
          return;
        }

        console.log(`[WebRTC Signal Received] type=${type} from ${senderName}`);

        try {
          switch (type as SignalType) {
            case 'offer': {
              if (this.isBusyWithAnotherUser(senderId)) {
                await this.sendSignal(senderId, 'busy');
                return;
              }

              const callType = data?.callType === 'video' ? 'video' : 'audio';
              useCallStore.getState().receiveCall(senderId, senderName, callType);
              this.resetPeerConnection();
              this.createPeerConnection(senderId);
              await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data?.description || data));
              await this.flushPendingCandidates();
              return;
            }
            case 'answer':
              await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data?.description || data));
              useCallStore.getState().acceptCall();
              await this.flushPendingCandidates();
              return;
            case 'ice-candidate':
              if (!data?.candidate) {
                return;
              }
              if (this.peerConnection?.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                this.pendingCandidates.push(data.candidate);
              }
              return;
            case 'busy':
              alert(`${senderName} is already on another call.`);
              this.cleanup();
              useCallStore.getState().endCall();
              return;
            case 'end_call':
              this.cleanup();
              useCallStore.getState().endCall();
              return;
            default:
              return;
          }
        } catch (error) {
          console.error('[WebRTC] Signal handling failed', error);
        }
      })
      .subscribe((status: string) => {
        console.log('[WebRTC] Signaling status:', status);

        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.resolveSignalingReady?.();
        }

        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.isSubscribed = false;
          this.rejectSignalingReady?.(new Error(`Signaling channel status: ${status}`));
          if (this.channel) {
            void supabase.removeChannel(this.channel);
          }
          this.resolveSignalingReady = null;
          this.rejectSignalingReady = null;
          this.signalingReady = null;
          this.channel = null;
        }
      });
  }

  async initiateCall(targetUserId: number, targetUsername: string, callType: CallType = 'audio') {
    try {
      if (useCallStore.getState().isInCall()) {
        alert('Finish the current call first.');
        return;
      }

      useCallStore.getState().startCall(targetUserId, targetUsername, callType);
      await this.ensureSignalingReady();
      await this.setupLocalMedia(callType);
      this.resetPeerConnection();
      this.createPeerConnection(targetUserId);

      const offer = await this.peerConnection?.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });

      if (offer) {
        await this.peerConnection?.setLocalDescription(offer);
        await this.sendSignal(targetUserId, 'offer', {
          callType,
          description: offer,
        });
      }
    } catch (error: any) {
      alert(`Call failed: ${error.message || 'Media access denied'}`);
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  async initiateVideoCall(targetUserId: number, targetUsername: string) {
    await this.initiateCall(targetUserId, targetUsername, 'video');
  }

  async answerCall(targetUserId: number) {
    try {
      const callType = useCallStore.getState().callType || 'audio';
      await this.ensureSignalingReady();
      await this.setupLocalMedia(callType);

      if (!this.peerConnection) {
        throw new Error('Incoming call session expired');
      }

      this.attachLocalTracks();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal(targetUserId, 'answer', {
        callType,
        description: answer,
      });
      useCallStore.getState().acceptCall();
    } catch (error: any) {
      alert(`Failed to answer: ${error.message || 'Media access denied'}`);
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  async rejectCall(targetUserId: number) {
    try {
      await this.sendSignal(targetUserId, 'end_call');
    } finally {
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  async endActiveCall() {
    const remoteId = useCallStore.getState().remoteUserId;

    try {
      if (remoteId) {
        await this.sendSignal(remoteId, 'end_call');
      }
    } finally {
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  private async sendSignal(targetId: number, type: SignalType, data?: SessionSignal) {
    const user = useAuthStore.getState().user;
    if (!this.channel || !user) {
      throw new Error('Signaling channel is not available');
    }

    await this.ensureSignalingReady();

    const response = await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        targetId,
        senderId: user.id,
        senderName: user.username,
        type,
        data,
      },
    });

    if (response !== 'ok') {
      console.error('[WebRTC Broadcast Error]', response);
      throw new Error('Failed to send signaling event');
    }
  }

  private async setupLocalMedia(callType: CallType) {
    const needsVideo = callType === 'video';
    const hasReusableStream =
      this.localStream &&
      this.localStream.getTracks().every((track) => track.readyState === 'live') &&
      Boolean(this.localStream.getAudioTracks().length) &&
      (!needsVideo || Boolean(this.localStream.getVideoTracks().length));

    if (hasReusableStream) {
      useCallStore.getState().setLocalStream(this.localStream);
      return this.localStream;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: needsVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
      });
      useCallStore.getState().setLocalStream(this.localStream);
      useCallStore.getState().setCameraEnabled(needsVideo);
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Media access denied', error);
      throw error;
    }
  }

  private createPeerConnection(targetUserId: number) {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    useCallStore.getState().setPeerConnection(this.peerConnection);

    this.attachLocalTracks();

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(targetUserId, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
        }).catch((error) => {
          console.error('[WebRTC] Failed to send ICE candidate', error);
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        useCallStore.getState().setRemoteStream(remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const connection = this.peerConnection;
      if (!connection) {
        return;
      }

      if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed' || connection.connectionState === 'closed') {
        this.cleanup();
        useCallStore.getState().endCall();
      }
    };
  }

  private attachLocalTracks() {
    if (!this.peerConnection || !this.localStream) {
      return;
    }

    const senderTrackIds = new Set(
      this.peerConnection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId))
    );

    this.localStream.getTracks().forEach((track) => {
      if (!senderTrackIds.has(track.id)) {
        this.peerConnection?.addTrack(track, this.localStream!);
      }
    });
  }

  private async flushPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      return;
    }

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];

    for (const candidate of candidates) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private resetPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
    }

    this.peerConnection = null;
    useCallStore.getState().setPeerConnection(null);
    useCallStore.getState().setRemoteStream(null);
    this.pendingCandidates = [];
  }

  private isBusyWithAnotherUser(senderId: number) {
    const state = useCallStore.getState();
    return state.isInCall() && state.remoteUserId !== senderId;
  }

  private async ensureSignalingReady() {
    if (!this.channel || !this.signalingReady) {
      this.initializeSignaling();
    }

    if (this.isSubscribed) {
      return;
    }

    await this.signalingReady;
  }

  teardownSignaling() {
    this.isSubscribed = false;
    this.resolveSignalingReady = null;
    this.rejectSignalingReady = null;
    this.signalingReady = null;

    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    this.localStream = null;
    useCallStore.getState().setLocalStream(null);
    this.resetPeerConnection();
  }

  destroy() {
    this.cleanup();
    useCallStore.getState().endCall();
    this.teardownSignaling();
  }
}

export const callService = new CallService();

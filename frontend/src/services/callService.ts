import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCallStore } from '../store/useCallStore';

class CallService {
  private channel: any = null;
  private signalingReady: Promise<void> | null = null;
  private resolveSignalingReady: (() => void) | null = null;
  private rejectSignalingReady: ((reason?: unknown) => void) | null = null;
  private isSubscribed = false;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: any[] = [];
  
  // Stun servers to help peers find each other through NATs/Firewalls
  private rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  /**
   * Initializes the global signaling channel for WebRTC
   * Uses Supabase Broadcast to listen for incoming rings or WebRTC signals
   */
  initializeSignaling() {
    const user = useAuthStore.getState().user;
    if (!user) return;

    this.teardownSignaling();

    console.log('[WebRTC] Joining global signaling channel');
    this.signalingReady = new Promise<void>((resolve, reject) => {
      this.resolveSignalingReady = resolve;
      this.rejectSignalingReady = reject;
    });
    void this.signalingReady.catch(() => {});

    this.channel = supabase.channel('calls_global', {
      config: { broadcast: { ack: true } }
    });
    
    // Listen for broadcast messages
    this.channel.on('broadcast', { event: 'signal' }, async (payload: any) => {
        const { targetId, senderId, senderName, type, data } = payload.payload;
        
        // Ignore signals not meant for me
        if (targetId !== user.id) return;

        console.log(`[WebRTC Signal Received] type=${type} from ${senderName}`);

        switch (type) {
            case 'offer':
                if (this.isBusyWithAnotherUser(senderId)) {
                    await this.sendSignal(senderId, 'busy');
                    break;
                }

                // Someone is calling me
                useCallStore.getState().receiveCall(senderId, senderName);
                this.resetPeerConnection();
                this.createPeerConnection(senderId);
                await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data));
                await this.flushPendingCandidates();
                break;
            case 'answer':
                // The person I called answered
                await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data));
                useCallStore.getState().acceptCall();
                await this.flushPendingCandidates();
                break;
            case 'ice-candidate':
                // Exchanging network paths
                try {
                    if (this.peerConnection && this.peerConnection.remoteDescription) {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
                    } else if (data) {
                        this.pendingCandidates.push(data);
                    }
                } catch(e) { console.error("[WebRTC] ICE error", e); }
                break;
            case 'busy':
                alert(`${senderName} is already on another call.`);
                this.cleanup();
                useCallStore.getState().endCall();
                break;
            case 'end_call':
                this.cleanup();
                useCallStore.getState().endCall();
                break;
        }
    }).subscribe((status: string) => {
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

  private async sendSignal(targetId: number, type: string, data?: any) {
    const user = useAuthStore.getState().user;
    if (!this.channel || !user) {
      throw new Error('Signaling channel is not available');
    }

    await this.ensureSignalingReady();
    
    const resp = await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        targetId,
        senderId: user.id,
        senderName: user.username,
        type,
        data
      }
    });

    if (resp !== 'ok') {
      console.error('[WebRTC Broadcast Error]', resp);
      throw new Error('Failed to send signaling event');
    }
  }

  async initiateCall(targetUserId: number, targetUsername: string) {
    try {
      if (useCallStore.getState().isInCall()) {
        alert('Finish the current call first.');
        return;
      }

      useCallStore.getState().startCall(targetUserId, targetUsername);
      await this.ensureSignalingReady();
      await this.setupLocalMedia();
      this.resetPeerConnection();
      this.createPeerConnection(targetUserId);

      const offer = await this.peerConnection?.createOffer();
      if (offer) {
          await this.peerConnection?.setLocalDescription(offer);
          await this.sendSignal(targetUserId, 'offer', offer);
      }
    } catch (err: any) {
      alert(`Call failed: ${err.message || 'Microphone access denied'}`);
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  async answerCall(targetUserId: number) {
    try {
      await this.ensureSignalingReady();
      await this.setupLocalMedia();
      if (!this.peerConnection) {
        throw new Error('Incoming call session expired');
      }
      this.attachLocalTracks();
      
      // Remote description was already set when 'offer' signal fired
      const answer = await this.peerConnection?.createAnswer();
      if (answer) {
          await this.peerConnection?.setLocalDescription(answer);
          await this.sendSignal(targetUserId, 'answer', answer);
          useCallStore.getState().acceptCall(); // switch UI to active call
      }
    } catch (err: any) {
      alert(`Failed to answer: ${err.message || 'Microphone access denied'}`);
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

  private async setupLocalMedia() {
    try {
        if (this.localStream && this.localStream.getTracks().some(track => track.readyState === 'live')) {
            useCallStore.getState().setLocalStream(this.localStream);
            return this.localStream;
        }

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        useCallStore.getState().setLocalStream(this.localStream);
        return this.localStream;
    } catch (err) {
        console.error('[WebRTC] Microphone access denied', err);
        throw err;
    }
  }

  private createPeerConnection(targetUserId: number) {
     this.peerConnection = new RTCPeerConnection(this.rtcConfig);
     useCallStore.getState().setPeerConnection(this.peerConnection);

     // Add local audio tracks
     this.attachLocalTracks();

     // Listen for network paths (ICE Candidates) and send to peer
     this.peerConnection.onicecandidate = (event) => {
         if (event.candidate) {
             void this.sendSignal(targetUserId, 'ice-candidate', event.candidate).catch((error) => {
                console.error('[WebRTC] Failed to send ICE candidate', error);
             });
         }
     };

     // When we get the remote audio stream from the peer
     this.peerConnection.ontrack = (event) => {
         const remoteStream = event.streams[0];
         useCallStore.getState().setRemoteStream(remoteStream);
     };

     // Handle disconnections natively
     this.peerConnection.oniceconnectionstatechange = () => {
         const connection = this.peerConnection;
         if (!connection) return;

         if (connection.iceConnectionState === 'disconnected' || connection.iceConnectionState === 'failed' || connection.iceConnectionState === 'closed') {
            this.cleanup();
            useCallStore.getState().endCall();
         }
     };
  }

  private attachLocalTracks() {
      if (!this.peerConnection || !this.localStream) return;

      const senderTrackIds = new Set(
        this.peerConnection
          .getSenders()
          .map((sender) => sender.track?.id)
          .filter((trackId): trackId is string => Boolean(trackId))
      );

      this.localStream.getAudioTracks().forEach((track) => {
          if (!senderTrackIds.has(track.id)) {
              this.peerConnection?.addTrack(track, this.localStream!);
          }
      });
  }

  private async flushPendingCandidates() {
      if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

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
          this.peerConnection.oniceconnectionstatechange = null;
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
          this.localStream.getTracks().forEach(track => track.stop());
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

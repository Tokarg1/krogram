import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCallStore } from '../store/useCallStore';

class CallService {
  private channel: any = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  
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

    if (this.channel) supabase.removeChannel(this.channel);

    console.log('[WebRTC] Joining global signaling channel');
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
                // Someone is calling me
                useCallStore.getState().receiveCall(senderId, senderName, data);
                if (!this.peerConnection) this.createPeerConnection(senderId);
                await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data));
                break;
            case 'answer':
                // The person I called answered
                await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data));
                useCallStore.getState().acceptCall();
                break;
            case 'ice-candidate':
                // Exchanging network paths
                if (this.peerConnection && data) {
                   await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
                }
                break;
            case 'end_call':
                this.cleanup();
                useCallStore.getState().endCall();
                break;
        }
    }).subscribe();
  }

  private sendSignal(targetId: number, type: string, data?: any) {
    const user = useAuthStore.getState().user;
    if (!this.channel || !user) return;
    
    this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        targetId,
        senderId: user.id,
        senderName: user.username,
        type,
        data
      }
    }).then((resp: any) => {
      if (resp !== 'ok') console.error('[WebRTC Broadcast Error]', resp);
    });
  }

  async initiateCall(targetUserId: number, targetUsername: string) {
    try {
      useCallStore.getState().startCall(targetUserId, targetUsername);
      await this.setupLocalMedia();
      this.createPeerConnection(targetUserId);

      const offer = await this.peerConnection?.createOffer();
      if (offer) {
          await this.peerConnection?.setLocalDescription(offer);
          this.sendSignal(targetUserId, 'offer', offer);
      }
    } catch (err: any) {
      alert(`Call failed: ${err.message || 'Microphone access denied'}`);
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  async answerCall(targetUserId: number) {
    try {
      await this.setupLocalMedia();
      
      // Remote description was already set when 'offer' signal fired
      const answer = await this.peerConnection?.createAnswer();
      if (answer) {
          await this.peerConnection?.setLocalDescription(answer);
          this.sendSignal(targetUserId, 'answer', answer);
          useCallStore.getState().acceptCall(); // switch UI to active call
      }
    } catch (err: any) {
      alert(`Failed to answer: ${err.message || 'Microphone access denied'}`);
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  rejectCall(targetUserId: number) {
    this.sendSignal(targetUserId, 'end_call');
    this.cleanup();
    useCallStore.getState().endCall();
  }

  endActiveCall() {
    const remoteId = useCallStore.getState().remoteUserId;
    if (remoteId) {
        this.sendSignal(remoteId, 'end_call');
    }
    this.cleanup();
    useCallStore.getState().endCall();
  }

  private async setupLocalMedia() {
    try {
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
     if (this.localStream) {
         this.localStream.getTracks().forEach(track => {
             this.peerConnection?.addTrack(track, this.localStream!);
         });
     }

     // Listen for network paths (ICE Candidates) and send to peer
     this.peerConnection.onicecandidate = (event) => {
         if (event.candidate) {
             this.sendSignal(targetUserId, 'ice-candidate', event.candidate);
         }
     };

     // When we get the remote audio stream from the peer
     this.peerConnection.ontrack = (event) => {
         const remoteStream = event.streams[0];
         useCallStore.getState().setRemoteStream(remoteStream);
     };

     // Handle disconnections natively
     this.peerConnection.oniceconnectionstatechange = () => {
         if (this.peerConnection?.iceConnectionState === 'disconnected' || this.peerConnection?.iceConnectionState === 'failed') {
            this.cleanup();
            useCallStore.getState().endCall();
         }
     };
  }

  private cleanup() {
      if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop());
      }
      if (this.peerConnection) {
          this.peerConnection.close();
      }
      this.localStream = null;
      this.peerConnection = null;
  }
}

export const callService = new CallService();

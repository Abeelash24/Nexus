import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CallSession, CallType, CallStatus, CallConnectionState, IncomingCallInvitation } from '../models/call.model';
import { ToastService } from './toast.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CallService implements OnDestroy {
  private toast = inject(ToastService);
  private supabase = inject(SupabaseService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  // Reactive state signals
  activeCall = signal<CallSession | null>(null);
  incomingCall = signal<IncomingCallInvitation | null>(null);
  connectionState = signal<CallConnectionState>('idle');
  isMicMuted = signal<boolean>(false);
  isVideoOff = signal<boolean>(false);
  isScreenSharing = signal<boolean>(false);
  callDuration = signal<number>(0);
  localStreamSignal = signal<MediaStream | null>(null);
  remoteStreamSignal = signal<MediaStream | null>(null);

  // Internal WebRTC & Signaling references
  private timerInterval: any = null;
  private peerConnection: RTCPeerConnection | null = null;
  private rawLocalStream: MediaStream | null = null;
  private rawScreenStream: MediaStream | null = null;
  private signalingChannel: any = null;
  private globalCallsSubscription: any = null;
  private queuedIceCandidates: RTCIceCandidateInit[] = [];
  private currentRoomId: string | null = null;

  // Computed public getters
  isInCall = computed(() => !!this.activeCall());
  localStream = computed(() => this.localStreamSignal());
  remoteStream = computed(() => this.remoteStreamSignal());

  constructor() {
    this.setupGlobalCallListeners();
  }

  ngOnDestroy() {
    this.endCall();
    if (this.globalCallsSubscription && this.supabase.client) {
      this.supabase.client.removeChannel(this.globalCallsSubscription);
      this.globalCallsSubscription = null;
    }
  }

  /**
   * Listens for incoming calls across the entire application via Supabase Realtime
   */
  private setupGlobalCallListeners() {
    if (!this.supabase.client) return;

    try {
      this.globalCallsSubscription = this.supabase.client
        .channel('careernexus_global_calls')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'calls' },
          (payload: any) => {
            const currentUserId = this.authService.currentUser()?.id;
            const newCall = payload.new;
            if (newCall && newCall.receiver_id === currentUserId && newCall.status === 'ringing') {
              this.handleIncomingCallRecord(newCall);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Could not subscribe to global calls listener:', err);
    }
  }

  private handleIncomingCallRecord(callRecord: any) {
    if (this.activeCall()) return; // Already on a call

    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;

    const roomId = `call-room:${[currentUserId, callRecord.caller_id].sort().join('_')}`;

    const invitation: IncomingCallInvitation = {
      callId: callRecord.id,
      roomId,
      callerId: callRecord.caller_id,
      callerName: callRecord.caller_name || 'Alumni Mentor',
      callerAvatar: callRecord.caller_avatar,
      callerRole: callRecord.caller_role || 'alumni',
      callType: callRecord.call_type || 'video',
      timestamp: callRecord.created_at || new Date().toISOString()
    };

    this.incomingCall.set(invitation);

    // Also auto-subscribe to the signaling channel so we receive offer & candidates
    this.subscribeToSignalingRoom(roomId, false);
  }

  /**
   * Canonical call-room generator: call-room:<sorted_uid_1>_<sorted_uid_2>
   */
  getCanonicalRoomId(userId1: string, userId2: string): string {
    return `call-room:${[userId1, userId2].sort().join('_')}`;
  }

  /**
   * Authoritative backend WebRTC authorization RPC caller.
   * Calls the PostgreSQL RPC authorize_webrtc_session().
   */
  async authorizeWebRTCCall(peerId: string): Promise<{ authorized: boolean; roomId?: string; error?: string }> {
    if (!this.supabase.client) {
      return { authorized: true, roomId: this.getCanonicalRoomId('u1', peerId) };
    }

    try {
      const { data, error } = await this.supabase.client.rpc('authorize_webrtc_session', {
        p_peer_id: peerId
      });

      if (error) {
        console.error('WebRTC Authorization RPC error:', error);
        return { authorized: false, error: error.message };
      }

      if (data?.authorized === true) {
        return { authorized: true, roomId: data.room_id || data.channel_name };
      }

      return {
        authorized: false,
        error: data?.error || 'Active accepted mentorship connection required.'
      };
    } catch (err: any) {
      console.error('Call authorization exception:', err);
      return { authorized: false, error: err.message || 'Authorization failed' };
    }
  }

  /**
   * Initiates a 1-on-1 WebRTC call session.
   */
  async startCall(
    participant: {
      id: string;
      name: string;
      avatar?: string;
      role: string;
    },
    type: CallType = 'video'
  ): Promise<boolean> {
    if (this.activeCall()) {
      this.toast.warning('Call in Progress', 'Please end your current call before placing a new one.');
      return false;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.toast.error('Authentication Required', 'Please sign in to make a call.');
      return false;
    }

    if (!participant?.id || participant.id === currentUser.id) {
      this.toast.error('Invalid Recipient', 'Cannot place a call to yourself or an invalid user.');
      return false;
    }

    this.connectionState.set('calling');

    // 1. Backend Authorization Gating via authorize_webrtc_session RPC
    const authResult = await this.authorizeWebRTCCall(participant.id);
    if (!authResult.authorized) {
      this.connectionState.set('idle');
      this.toast.error('Call Not Allowed', authResult.error || 'Mentorship connection is not accepted.');
      return false;
    }

    const roomId = authResult.roomId || this.getCanonicalRoomId(currentUser.id, participant.id);
    this.currentRoomId = roomId;

    // 2. Hardware permissions (getUserMedia)
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };
      this.rawLocalStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStreamSignal.set(this.rawLocalStream);
    } catch (mediaErr: any) {
      this.connectionState.set('idle');
      if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
        this.toast.error('Permission Denied', 'Please grant microphone and camera permissions.');
      } else {
        this.toast.error('Media Device Notice', 'Could not access audio/video devices.');
      }
      return false;
    }

    const session: CallSession = {
      id: `call-${Date.now()}`,
      callerId: currentUser.id,
      callerName: currentUser.fullName || 'CareerNexus Candidate',
      callerAvatar: currentUser.avatarUrl,
      callerRole: currentUser.role || 'student',
      receiverId: participant.id,
      receiverName: participant.name,
      receiverAvatar: participant.avatar,
      receiverRole: participant.role,
      callType: type,
      status: 'ringing',
      roomId
    };

    // 3. Record Call in Supabase
    if (this.supabase.client) {
      try {
        const { data, error: insertErr } = await this.supabase.client
          .from('calls')
          .insert({
            caller_id: currentUser.id,
            caller_name: currentUser.fullName,
            caller_avatar: currentUser.avatarUrl || null,
            caller_role: currentUser.role,
            receiver_id: participant.id,
            receiver_name: participant.name,
            receiver_avatar: participant.avatar || null,
            receiver_role: participant.role,
            call_type: type,
            status: 'ringing'
          })
          .select()
          .single();

        if (!insertErr && data) {
          session.id = data.id;
        } else if (insertErr) {
          console.warn('Call record insert notice:', insertErr.message);
        }
      } catch (err) {
        console.warn('Error recording call session:', err);
      }
    }

    this.activeCall.set(session);
    this.isMicMuted.set(false);
    this.isVideoOff.set(false);
    this.isScreenSharing.set(false);
    this.callDuration.set(0);

    // 4. Initialize RTCPeerConnection
    await this.initPeerConnection();

    // 5. Subscribe to Supabase Realtime Room Channel
    await this.subscribeToSignalingRoom(roomId, true);

    // 6. Send Realtime Notification to peer with deep link
    try {
      const recipientRoute = participant.role === 'alumni'
        ? `/alumni/calls?peerId=${currentUser.id}&roomId=${roomId}&callType=${type}`
        : `/student/calls?peerId=${currentUser.id}&roomId=${roomId}&callType=${type}`;

      await this.notificationService.addNotification({
        userId: participant.id,
        senderId: currentUser.id,
        type: 'call',
        title: `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`,
        message: `${currentUser.fullName} is calling you. Click to join the 1-on-1 session.`,
        link: recipientRoute,
        referenceType: 'call_session',
        referenceId: roomId
      });
    } catch (notifErr) {
      console.warn('Could not dispatch call push notification:', notifErr);
    }

    return true;
  }

  /**
   * Accepts an incoming call invitation and connects media
   */
  async acceptIncomingCall(invitation: IncomingCallInvitation): Promise<boolean> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return false;

    this.incomingCall.set(null);
    this.connectionState.set('connecting');

    // 1. Authorize session
    const authResult = await this.authorizeWebRTCCall(invitation.callerId);
    if (!authResult.authorized) {
      this.connectionState.set('idle');
      this.toast.error('Call Not Allowed', authResult.error || 'Connection not accepted.');
      return false;
    }

    const roomId = invitation.roomId || this.getCanonicalRoomId(currentUser.id, invitation.callerId);
    this.currentRoomId = roomId;

    // 2. Hardware permissions
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: invitation.callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };
      this.rawLocalStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStreamSignal.set(this.rawLocalStream);
    } catch (mediaErr: any) {
      this.connectionState.set('idle');
      this.toast.error('Device Access Notice', 'Could not open media devices.');
      return false;
    }

    const session: CallSession = {
      id: invitation.callId,
      callerId: invitation.callerId,
      callerName: invitation.callerName,
      callerAvatar: invitation.callerAvatar,
      callerRole: invitation.callerRole,
      receiverId: currentUser.id,
      receiverName: currentUser.fullName,
      receiverAvatar: currentUser.avatarUrl,
      receiverRole: currentUser.role,
      callType: invitation.callType,
      status: 'connected',
      roomId,
      startedAt: new Date().toISOString()
    };

    this.activeCall.set(session);
    this.isMicMuted.set(false);
    this.isVideoOff.set(false);
    this.isScreenSharing.set(false);
    this.callDuration.set(0);

    // 3. Initialize RTCPeerConnection
    await this.initPeerConnection();

    // 4. Subscribe to Realtime channel and notify caller that call was accepted
    await this.subscribeToSignalingRoom(roomId, false);

    // Update DB record
    if (this.supabase.client && !invitation.callId.startsWith('call-')) {
      try {
        await this.supabase.client
          .from('calls')
          .update({ status: 'connected', started_at: new Date().toISOString() })
          .eq('id', invitation.callId);
      } catch {}
    }

    this.startDurationTimer();
    return true;
  }

  /**
   * Declines an incoming call invitation
   */
  async declineIncomingCall(invitation: IncomingCallInvitation): Promise<void> {
    const roomId = invitation.roomId;
    if (this.signalingChannel) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call-decline',
        payload: { callId: invitation.callId, senderId: this.authService.currentUser()?.id }
      });
    }

    this.incomingCall.set(null);

    if (this.supabase.client && !invitation.callId.startsWith('call-')) {
      try {
        await this.supabase.client
          .from('calls')
          .update({ status: 'rejected', ended_at: new Date().toISOString() })
          .eq('id', invitation.callId);
      } catch {}
    }

    this.toast.info('Call Declined', `Declined call from ${invitation.callerName}.`);
  }

  /**
   * RTCPeerConnection initialization with STUN/TURN servers
   */
  private async initPeerConnection(): Promise<void> {
    const rtcConfig: RTCConfiguration = {
      iceServers: environment.webrtc?.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Attach local tracks
    if (this.rawLocalStream) {
      this.rawLocalStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.rawLocalStream!);
      });
    }

    // Handle remote track arrivals
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStreamSignal.set(event.streams[0]);
        this.connectionState.set('connected');
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingChannel) {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            senderId: this.authService.currentUser()?.id
          }
        });
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.connectionState.set('connected');
      } else if (state === 'connecting') {
        this.connectionState.set('connecting');
      } else if (state === 'disconnected') {
        this.connectionState.set('disconnected');
      } else if (state === 'failed') {
        this.connectionState.set('disconnected');
        this.toast.warning('Connection Issue', 'Media connection interrupted. Reconnecting...');
      } else if (state === 'closed') {
        this.connectionState.set('ended');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        this.connectionState.set('connected');
      } else if (iceState === 'disconnected') {
        this.connectionState.set('reconnecting');
      }
    };
  }

  /**
   * Subscribes to the Supabase Realtime broadcast channel for WebRTC signaling.
   */
  private async subscribeToSignalingRoom(roomId: string, isCaller: boolean): Promise<void> {
    if (!this.supabase.client) return;

    if (this.signalingChannel) {
      try {
        this.supabase.client.removeChannel(this.signalingChannel);
      } catch {}
      this.signalingChannel = null;
    }

    this.signalingChannel = this.supabase.client.channel(roomId);

    this.signalingChannel
      // 1. Incoming Call Invite
      .on('broadcast', { event: 'call-invite' }, (msg: any) => {
        const payload = msg.payload;
        const currentUserId = this.authService.currentUser()?.id;
        if (payload && payload.receiverId === currentUserId && !this.activeCall()) {
          this.incomingCall.set({
            callId: payload.callId,
            roomId,
            callerId: payload.callerId,
            callerName: payload.callerName,
            callerAvatar: payload.callerAvatar,
            callerRole: payload.callerRole,
            callType: payload.callType,
            timestamp: new Date().toISOString()
          });
        }
      })

      // 2. SDP Offer (Recipient sets remote offer and answers)
      .on('broadcast', { event: 'offer' }, async (msg: any) => {
        const { sdp, callerId } = msg.payload || {};
        const currentUserId = this.authService.currentUser()?.id;

        if (callerId !== currentUserId && this.peerConnection && sdp) {
          try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            this.flushQueuedIceCandidates();

            // Create and send SDP Answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.signalingChannel.send({
              type: 'broadcast',
              event: 'answer',
              payload: {
                sdp: answer,
                senderId: currentUserId
              }
            });

            this.connectionState.set('connected');
          } catch (err) {
            console.warn('Error handling SDP offer:', err);
          }
        }
      })

      // 3. SDP Answer (Caller sets remote answer)
      .on('broadcast', { event: 'answer' }, async (msg: any) => {
        const { sdp, senderId } = msg.payload || {};
        const currentUserId = this.authService.currentUser()?.id;

        if (senderId !== currentUserId && this.peerConnection && sdp) {
          try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            this.flushQueuedIceCandidates();
            this.connectionState.set('connected');
            this.activeCall.update(c => c ? { ...c, status: 'connected', startedAt: new Date().toISOString() } : null);
            this.startDurationTimer();
            this.toast.success('Call Connected', 'Peer-to-peer WebRTC connection established.');
          } catch (err) {
            console.warn('Error handling SDP answer:', err);
          }
        }
      })

      // 4. ICE Candidate exchange
      .on('broadcast', { event: 'ice-candidate' }, async (msg: any) => {
        const { candidate, senderId } = msg.payload || {};
        const currentUserId = this.authService.currentUser()?.id;

        if (senderId !== currentUserId && candidate) {
          if (this.peerConnection && this.peerConnection.remoteDescription) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (iceErr) {
              console.warn('Error adding ICE candidate:', iceErr);
            }
          } else {
            this.queuedIceCandidates.push(candidate);
          }
        }
      })

      // 5. Call End
      .on('broadcast', { event: 'call-end' }, () => {
        this.endCall(false);
      })

      // 6. Call Decline
      .on('broadcast', { event: 'call-decline' }, () => {
        this.toast.info('Call Declined', 'The participant was unable to accept your call.');
        this.endCall(false);
      });

    await this.signalingChannel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED' && isCaller) {
        // Broadcast invite
        const current = this.activeCall();
        if (current) {
          this.signalingChannel.send({
            type: 'broadcast',
            event: 'call-invite',
            payload: {
              callId: current.id,
              roomId,
              callerId: current.callerId,
              callerName: current.callerName,
              callerAvatar: current.callerAvatar,
              callerRole: current.callerRole,
              receiverId: current.receiverId,
              callType: current.callType
            }
          });

          // Create & send SDP Offer
          if (this.peerConnection) {
            try {
              const offer = await this.peerConnection.createOffer();
              await this.peerConnection.setLocalDescription(offer);

              this.signalingChannel.send({
                type: 'broadcast',
                event: 'offer',
                payload: {
                  sdp: offer,
                  callerId: current.callerId,
                  receiverId: current.receiverId,
                  callType: current.callType
                }
              });
            } catch (err) {
              console.warn('Error creating SDP offer:', err);
            }
          }
        }
      }
    });
  }

  private flushQueuedIceCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.queuedIceCandidates.length > 0) {
      const candidate = this.queuedIceCandidates.shift();
      if (candidate) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.warn('Error adding queued ICE candidate:', err);
        });
      }
    }
  }

  // Media Controls: Mic Mute/Unmute
  toggleMic() {
    const nextMuted = !this.isMicMuted();
    this.isMicMuted.set(nextMuted);
    if (this.rawLocalStream) {
      this.rawLocalStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
  }

  // Media Controls: Camera On/Off
  toggleVideo() {
    const nextVideoOff = !this.isVideoOff();
    this.isVideoOff.set(nextVideoOff);
    if (this.rawLocalStream) {
      this.rawLocalStream.getVideoTracks().forEach(track => {
        track.enabled = !nextVideoOff;
      });
    }
  }

  // Media Controls: Screen Share
  async toggleScreenShare(): Promise<void> {
    if (this.isScreenSharing()) {
      // Stop Screen Sharing and revert to camera track
      this.stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      this.rawScreenStream = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) return;

      // Replace track on RTCPeerConnection sender
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }
      }

      // Revert when user clicks browser's native "Stop sharing" bar
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.isScreenSharing.set(true);
      this.toast.info('Screen Sharing', 'Your screen is now visible to the other participant.');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Screen share notice:', err);
        this.toast.warning('Screen Share Notice', 'Could not share screen: ' + (err.message || 'Aborted'));
      }
    }
  }

  private stopScreenShare() {
    if (this.rawScreenStream) {
      this.rawScreenStream.getTracks().forEach(t => t.stop());
      this.rawScreenStream = null;
    }

    // Re-attach original camera track to peer connection
    if (this.peerConnection && this.rawLocalStream) {
      const cameraTrack = this.rawLocalStream.getVideoTracks()[0];
      if (cameraTrack) {
        const videoSender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
    }

    this.isScreenSharing.set(false);
  }

  /**
   * Guaranteed cleanup: track.stop(), peerConnection.close(), removeChannel()
   */
  async endCall(broadcastEnd = true): Promise<void> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const current = this.activeCall();
    const duration = this.callDuration();

    // 1. Broadcast call-end if requested
    if (broadcastEnd && this.signalingChannel) {
      try {
        this.signalingChannel.send({
          type: 'broadcast',
          event: 'call-end',
          payload: { callId: current?.id, senderId: this.authService.currentUser()?.id }
        });
      } catch {}
    }

    // 2. Stop all local tracks (camera, mic, screen share)
    if (this.rawLocalStream) {
      this.rawLocalStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      this.rawLocalStream = null;
    }

    if (this.rawScreenStream) {
      this.rawScreenStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      this.rawScreenStream = null;
    }

    this.localStreamSignal.set(null);
    this.remoteStreamSignal.set(null);

    // 3. Close RTCPeerConnection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    // 4. Remove signaling channel
    if (this.signalingChannel && this.supabase.client) {
      try {
        this.supabase.client.removeChannel(this.signalingChannel);
      } catch {}
      this.signalingChannel = null;
    }

    this.queuedIceCandidates = [];
    this.currentRoomId = null;

    // 5. Update call record in database
    if (current && this.supabase.client && !current.id.startsWith('call-')) {
      try {
        await this.supabase.client
          .from('calls')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration_seconds: duration
          })
          .eq('id', current.id);
      } catch (err) {
        console.warn('Call record update notice:', err);
      }
    }

    if (current) {
      this.toast.info('Call Ended', `Call session ended (${this.formatDuration(duration)}).`);
    }

    this.activeCall.set(null);
    this.connectionState.set('idle');
    this.callDuration.set(0);
    this.isScreenSharing.set(false);
  }

  private startDurationTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.callDuration.update(d => d + 1);
    }, 1000);
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

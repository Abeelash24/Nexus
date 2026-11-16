export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'rejected' | 'ended' | 'missed';
export type CallConnectionState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'ended';

export type CallSignalingEvent =
  | 'call-invite'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'call-end'
  | 'call-decline';

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerRole: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  receiverRole: string;
  callType: CallType;
  status: CallStatus;
  roomId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
}

export interface IncomingCallInvitation {
  callId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerRole: string;
  callType: CallType;
  timestamp: string;
}

export interface UserPublic {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface UserMe extends UserPublic {
  email: string;
  is_verified: boolean;
  show_last_seen: boolean;
  show_read_receipts: boolean;
  created_at: string;
}

export type MessageType = "text" | "image" | "video" | "audio" | "document" | "voice" | "system";

export interface AttachmentOut {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
}

export interface ReactionOut {
  user_id: string;
  emoji: string;
}

export interface MessageOut {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: UserPublic;
  message_type: MessageType;
  content: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted_for_everyone: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  attachments: AttachmentOut[];
  reactions: ReactionOut[];
}

export interface ConversationListItem {
  id: string;
  is_group: boolean;
  name: string | null;
  group_image_url: string | null;
  other_user: UserPublic | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  is_pinned: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export type CallStatus = "ringing" | "ongoing" | "completed" | "missed" | "rejected" | "cancelled";

export interface CallOut {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface CallHistoryItem {
  id: string;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_outgoing: boolean;
  other_user: UserPublic;
}

export type WsEvent =
  | { type: "new_message"; conversation_id: string; message: MessageOut }
  | { type: "message_edited"; conversation_id: string; message: MessageOut }
  | { type: "message_deleted"; conversation_id: string; message_id: string }
  | { type: "message_reaction"; conversation_id: string; message: MessageOut }
  | { type: "message_pinned"; conversation_id: string; message: MessageOut }
  | { type: "messages_read"; conversation_id: string; reader_id: string; message_ids: string[] }
  | { type: "presence_update"; user_id: string; is_online: boolean }
  | { type: "typing"; conversation_id: string; user_id: string }
  | { type: "stop_typing"; conversation_id: string; user_id: string }
  | { type: "notification"; notification_type: string; conversation_id: string; title: string; body: string }
  | {
      type: "incoming_call";
      call_id: string;
      conversation_id: string;
      caller: { id: string; username: string; full_name: string; avatar_url: string | null };
    }
  | { type: "call_accepted"; call_id: string }
  | { type: "call_rejected"; call_id: string }
  | { type: "call_ended"; call_id: string; status: CallStatus }
  | { type: "call_offer"; call_id: string; from_user_id: string; sdp: RTCSessionDescriptionInit }
  | { type: "call_answer"; call_id: string; from_user_id: string; sdp: RTCSessionDescriptionInit }
  | { type: "call_ice_candidate"; call_id: string; from_user_id: string; candidate: RTCIceCandidateInit }
  | { type: "pong" };

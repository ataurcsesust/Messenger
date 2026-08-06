import { api } from "./api";
import type { CallHistoryItem, CallOut, ConversationListItem, MessageOut, UserPublic } from "../types";

export const callApi = {
  initiate: (calleeId: string) => api.post<CallOut>("/calls", { callee_id: calleeId }).then((r) => r.data),
  accept: (callId: string) => api.post<CallOut>(`/calls/${callId}/accept`).then((r) => r.data),
  reject: (callId: string) => api.post<CallOut>(`/calls/${callId}/reject`).then((r) => r.data),
  end: (callId: string) => api.post<CallOut>(`/calls/${callId}/end`).then((r) => r.data),
  history: (limit = 30, offset = 0) =>
    api.get<CallHistoryItem[]>("/calls", { params: { limit, offset } }).then((r) => r.data),
  get: (callId: string) => api.get<CallOut>(`/calls/${callId}`).then((r) => r.data),
};

export const chatApi = {
  listConversations: () => api.get<ConversationListItem[]>("/conversations").then((r) => r.data),

  searchUsers: (q: string) => api.get<UserPublic[]>("/users/search", { params: { q } }).then((r) => r.data),

  createDirectConversation: (userId: string) =>
    api.post("/conversations/direct", { user_id: userId }).then((r) => r.data),

  createGroup: (name: string, memberIds: string[], description?: string) =>
    api.post("/conversations/group", { name, description, member_ids: memberIds }).then((r) => r.data),

  getMessages: (conversationId: string, before?: string) =>
    api
      .get(`/conversations/${conversationId}/messages`, { params: before ? { before } : {} })
      .then((r) => r.data as { items: MessageOut[]; has_more: boolean; next_cursor: string | null }),

  sendMessage: (conversationId: string, content: string, replyToId?: string, clientMessageId?: string) =>
    api
      .post(`/conversations/${conversationId}/messages`, {
        content,
        reply_to_id: replyToId,
        client_message_id: clientMessageId,
      })
      .then((r) => r.data as MessageOut),

  sendFile: (conversationId: string, file: File, content?: string, clientMessageId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (content) form.append("content", content);
    if (clientMessageId) form.append("client_message_id", clientMessageId);
    return api
      .post(`/conversations/${conversationId}/messages/with-attachment`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data as MessageOut);
  },

  editMessage: (messageId: string, content: string) =>
    api.patch(`/messages/${messageId}`, { content }).then((r) => r.data as MessageOut),

  deleteForMe: (messageId: string) => api.delete(`/messages/${messageId}/for-me`),
  deleteForEveryone: (messageId: string) => api.delete(`/messages/${messageId}/for-everyone`),

  react: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/react`, { emoji }).then((r) => r.data as MessageOut),

  pin: (messageId: string, pinned: boolean) =>
    api.post(`/messages/${messageId}/pin`, null, { params: { pinned } }).then((r) => r.data as MessageOut),

  forward: (messageId: string, conversationIds: string[]) =>
    api.post(`/messages/${messageId}/forward`, { conversation_ids: conversationIds }),

  markRead: (conversationId: string) => api.post(`/conversations/${conversationId}/read`),

  muteConversation: (conversationId: string, muted: boolean) =>
    api.post(`/conversations/${conversationId}/mute`, null, { params: { muted } }),

  archiveConversation: (conversationId: string, archived: boolean) =>
    api.post(`/conversations/${conversationId}/archive`, null, { params: { archived } }),

  pinConversation: (conversationId: string, pinned: boolean) =>
    api.post(`/conversations/${conversationId}/pin`, null, { params: { pinned } }),

  updateProfile: (data: { full_name?: string; bio?: string }) => api.patch("/users/me", data).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/users/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
};

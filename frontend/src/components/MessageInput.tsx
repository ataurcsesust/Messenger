import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Send, Smile, Paperclip, Mic, Square, X, Pencil, FileText } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import type { MessageOut } from "../types";

interface MessageInputProps {
  onSendText: (content: string) => void;
  onSendFile: (file: File, caption?: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  replyingTo: MessageOut | null;
  onCancelReply: () => void;
  editingMessage: MessageOut | null;
  onCancelEdit: () => void;
  onSubmitEdit: (content: string) => void;
}

export function MessageInput({
  onSendText,
  onSendFile,
  onTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSubmitEdit,
}: MessageInputProps) {
  const [text, setText] = useState(editingMessage?.content ?? "");
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (editingMessage && text === "" && editingMessage.content) {
    setText(editingMessage.content);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(onStopTyping, 2000);
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editingMessage) {
      onSubmitEdit(trimmed);
    } else {
      onSendText(trimmed);
    }
    setText("");
    onStopTyping();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      if (editingMessage) onCancelEdit();
      if (replyingTo) onCancelReply();
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPendingPreviewUrl(file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : null);
    }
    e.target.value = "";
  }

  function cancelPendingFile() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setCaption("");
  }

  function confirmSendFile() {
    if (!pendingFile) return;
    onSendFile(pendingFile, caption.trim() || undefined);
    cancelPendingFile();
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setPendingFile(file);
        setPendingPreviewUrl(URL.createObjectURL(file));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access is needed to record a voice message.");
    }
  }

  return (
    <div className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl px-4 py-3 transition-colors duration-200">
      {pendingFile && (
        <div className="mb-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 shadow-xs">
          <div className="flex items-start gap-3">
            {pendingFile.type.startsWith("image/") && pendingPreviewUrl ? (
              <img src={pendingPreviewUrl} alt={pendingFile.name} className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
            ) : pendingFile.type.startsWith("video/") && pendingPreviewUrl ? (
              <video src={pendingPreviewUrl} className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
            ) : pendingFile.type.startsWith("audio/") && pendingPreviewUrl ? (
              <audio src={pendingPreviewUrl} controls className="h-10 max-w-[180px]" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <FileText className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{pendingFile.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{(pendingFile.size / 1024).toFixed(0)} KB</p>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button onClick={cancelPendingFile} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0" aria-label="Cancel file">
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={confirmSendFile}
            className="mt-2.5 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <Send className="h-3.5 w-3.5" /> Send attachment
          </button>
        </div>
      )}

      {(replyingTo || editingMessage) && (
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 mb-2 text-sm border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
            {editingMessage ? <Pencil className="h-3.5 w-3.5 text-blue-500 shrink-0" /> : <span className="shrink-0 text-blue-500">↩</span>}
            <span className="truncate font-medium">
              {editingMessage ? "Editing message" : `Replying to: ${replyingTo?.content ?? "attachment"}`}
            </span>
          </div>
          <button onClick={editingMessage ? onCancelEdit : onCancelReply} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Cancel context">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          title="Attach a file"
          aria-label="Attach a file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="relative flex-1">
          <textarea
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="w-full resize-none rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/80 px-4 py-2.5 pr-10 text-[15px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 max-h-32 transition-all"
          />
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Emoji picker"
            aria-label="Emoji picker"
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={(emoji) => setText((t) => t + emoji)}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        {text.trim() ? (
          <button
            onClick={handleSubmit}
            className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-xs hover:scale-105 active:scale-95 transition-all"
            title="Send message"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            className={`p-2.5 rounded-full shrink-0 transition-all ${
              isRecording ? "bg-red-500 text-white animate-pulse" : "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95 shadow-xs"
            }`}
            title={isRecording ? "Stop recording" : "Record a voice message"}
            aria-label={isRecording ? "Stop recording" : "Record voice message"}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}


const EMOJIS = [
  "😀", "😂", "🥹", "😍", "😘", "😎", "🤔", "😢", "😭", "😡",
  "👍", "👎", "👏", "🙏", "💪", "🤝", "❤️", "🔥", "🎉", "✨",
  "😊", "😅", "🙄", "😴", "🤯", "🥳", "😇", "🫡", "👀", "💯",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div
      className="absolute bottom-full mb-2 left-0 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 w-64 transition-colors duration-200"
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-6 gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl p-1.5 transition transform hover:scale-110"
            aria-label={`Select ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}


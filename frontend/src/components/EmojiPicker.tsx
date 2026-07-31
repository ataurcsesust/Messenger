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
      className="absolute bottom-full mb-2 left-0 z-20 bg-white dark:bg-base-800 border border-base-200 dark:border-base-700 rounded-2xl shadow-lg p-3 w-64"
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
            className="text-xl hover:bg-base-100 dark:hover:bg-base-700 rounded-lg p-1.5 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

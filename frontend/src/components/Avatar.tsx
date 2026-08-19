import { resolveMediaUrl } from "../utils/url";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  isOnline?: boolean;
  showStatus?: boolean;
}

const sizeMap = { sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg" };
const dotSizeMap = { sm: "h-2.5 w-2.5", md: "h-3 w-3", lg: "h-4 w-4" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, src, size = "md", isOnline, showStatus = true }: AvatarProps) {
  const resolvedSrc = resolveMediaUrl(src);
  return (
    <div className="relative shrink-0">
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover ring-2 ring-slate-200/80 dark:ring-slate-800 transition-colors duration-200`}
        />

      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-slate-500 to-slate-700 dark:from-slate-700 dark:to-slate-900 flex items-center justify-center font-bold text-white shadow-2xs ring-2 ring-slate-200/80 dark:ring-slate-800 transition-colors duration-200`}
        >
          {initials(name)}
        </div>
      )}
      {showStatus && isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizeMap[size]} rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900`}
        />
      )}
    </div>
  );
}


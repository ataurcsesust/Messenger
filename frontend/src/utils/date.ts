import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

export function formatMessageTime(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isToday(date)) return `today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `yesterday at ${format(date, "h:mm a")}`;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function isSameDay(isoA: string, isoB: string): boolean {
  return new Date(isoA).toDateString() === new Date(isoB).toDateString();
}

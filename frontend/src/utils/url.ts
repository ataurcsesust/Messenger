import { API_BASE_URL } from "../services/api";

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  let resolved = url;

  // If stored URL points to http://localhost:8000 or relative /uploads, resolve against API_BASE_URL
  if (resolved.startsWith("http://localhost:8000") || resolved.startsWith("http://127.0.0.1:8000")) {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      const apiHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
      resolved = resolved.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, apiHost);
    }
  } else if (resolved.startsWith("/")) {
    const apiHost = API_BASE_URL.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    resolved = `${apiHost}${resolved}`;
  }

  // Force HTTPS if page is loaded over HTTPS to prevent Mixed Content blocking
  if (window.location.protocol === "https:" && resolved.startsWith("http://") && !resolved.includes("localhost") && !resolved.includes("127.0.0.1")) {
    resolved = "https://" + resolved.slice(7);
  }

  return resolved;
}

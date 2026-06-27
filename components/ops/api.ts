function clientModeHeader() {
  if (typeof window === "undefined") return "web";
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    || window.location.pathname === "/app"
    || window.location.pathname.startsWith("/app/");
  return standalone ? "app" : "web";
}

function requestHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-CCTV-Client", clientModeHeader());
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: requestHeaders(init),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Không thể xử lý yêu cầu");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

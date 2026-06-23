"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/components/ops/api";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PushStatusResponse = {
  configured: boolean;
  subscriptions: Array<{
    endpoint: string;
    device_name: string | null;
    last_seen_at: string;
    created_at: string;
  }>;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function detectIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function detectStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function deviceName() {
  if (detectIOS()) return "iPhone/iPad";
  if (/Android/i.test(navigator.userAgent)) return "Android";
  if (/Windows/i.test(navigator.userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(navigator.userAgent)) return "macOS";
  return "Trình duyệt web";
}

export function usePwaPush({
  enabled,
  onPushReceived,
}: {
  enabled: boolean;
  onPushReceived: () => void;
}) {
  const onPushReceivedRef = useRef(onPushReceived);
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    onPushReceivedRef.current = onPushReceived;
  }, [onPushReceived]);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    setIsIOS(detectIOS());
    setIsStandalone(detectStandalone());

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_RECEIVED") {
        onPushReceivedRef.current();
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  const initialize = useCallback(async () => {
    const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(canPush);
    setPermission(canPush ? Notification.permission : "unsupported");
    if (!canPush || !enabled) return;

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const currentSubscription = await registration.pushManager.getSubscription();
    setSubscription(currentSubscription);

    const status = await apiFetch<PushStatusResponse>("/api/push-subscriptions");
    setConfigured(status.configured);

    let activeSubscription = currentSubscription;
    if (!activeSubscription && Notification.permission === "granted" && status.configured) {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (publicKey) {
        try {
          const nextSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          activeSubscription = nextSubscription;
          setSubscription(nextSubscription);
        } catch (error) {
          console.error("Tự động đăng ký thông báo thất bại:", error);
        }
      }
    }

    if (activeSubscription) {
      const serialized = activeSubscription.toJSON();
      if (serialized.endpoint && serialized.keys?.p256dh && serialized.keys.auth) {
        await apiFetch("/api/push-subscriptions", {
          method: "POST",
          body: JSON.stringify({
            endpoint: serialized.endpoint,
            keys: serialized.keys,
            deviceName: deviceName(),
          }),
        });
      }
    }
  }, [enabled]);

  useEffect(() => {
    initialize().catch((error) => {
      setFeedback(error instanceof Error ? error.message : "Không thể khởi tạo thông báo");
    });
  }, [initialize]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      if (!supported) throw new Error("Thiết bị này không hỗ trợ Web Push");
      if (!configured) throw new Error("Máy chủ chưa được cấu hình VAPID");
      if (isIOS && !isStandalone) {
        throw new Error("Trên iPhone/iPad, hãy thêm ứng dụng vào Màn hình chính rồi mở lại từ biểu tượng.");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error("Bạn chưa cho phép ứng dụng gửi thông báo");
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Thiếu VAPID public key");
      const registration = await navigator.serviceWorker.ready;
      const nextSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const serialized = nextSubscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
        throw new Error("Trình duyệt trả về đăng ký Push không hợp lệ");
      }

      await apiFetch("/api/push-subscriptions", {
        method: "POST",
        body: JSON.stringify({
          endpoint: serialized.endpoint,
          keys: serialized.keys,
          deviceName: deviceName(),
        }),
      });
      setSubscription(nextSubscription);
      setFeedback("Đã bật thông báo cho thiết bị này.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Không thể bật thông báo");
    } finally {
      setBusy(false);
    }
  }, [configured, isIOS, isStandalone, supported]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const current = subscription ?? await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (current) {
        try {
          await apiFetch("/api/push-subscriptions", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: current.endpoint }),
          });
        } finally {
          await current.unsubscribe();
        }
      }
      setSubscription(null);
      setFeedback("Đã tắt thông báo trên thiết bị này.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Không thể tắt thông báo");
    } finally {
      setBusy(false);
    }
  }, [subscription]);

  const install = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  return {
    supported,
    configured,
    permission,
    subscribed: Boolean(subscription),
    subscription,
    canInstall: Boolean(installPrompt),
    isIOS,
    isStandalone,
    busy,
    feedback,
    install,
    subscribe,
    unsubscribe,
  };
}

export type PwaPushController = ReturnType<typeof usePwaPush>;

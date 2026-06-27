"use client";

import { Bell, BellOff, CheckCircle2, Download, Smartphone } from "lucide-react";
import type { PwaPushController } from "@/components/ops/use-pwa-push";

export function PwaPushSettings({ push }: { push: PwaPushController }) {
  const isBrowserMode = push.supported && !push.isStandalone;
  const status = isBrowserMode
    ? "Thông báo chỉ bật trong ứng dụng đã cài"
    : push.subscribed
    ? "Thiết bị đã đăng ký nhận thông báo"
    : push.permission === "denied"
      ? "Trình duyệt đang chặn thông báo"
      : push.supported
        ? "Thiết bị chưa bật thông báo"
        : "Trình duyệt không hỗ trợ Web Push";

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="push-settings-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Smartphone size={20} />
          </div>
          <div>
            <h3 id="push-settings-title" className="text-sm font-bold text-slate-950">
              Cài ứng dụng và thông báo
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Cài lên màn hình chính và mở từ biểu tượng app để nhận thông báo riêng, không lẫn với tab Chrome.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              {push.subscribed ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Bell size={14} />}
              {status}
            </p>
            {push.supported && !push.isStandalone ? (
              <p className="mt-2 text-xs text-amber-700">
                Hãy mở từ biểu tượng ứng dụng đã cài để bật hoặc tắt thông báo. Tab Chrome chỉ dùng để thao tác web.
              </p>
            ) : null}
            {!push.configured && push.supported ? (
              <p className="mt-2 text-xs text-red-600">Máy chủ chưa có VAPID key nên chưa thể bật Push.</p>
            ) : null}
            {push.feedback ? <p className="mt-2 text-xs text-blue-700">{push.feedback}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {push.canInstall ? (
            <button className="btn-secondary h-9 text-xs" type="button" onClick={push.install} disabled={push.busy}>
              <Download size={14} /> Cài ứng dụng
            </button>
          ) : null}
          {!push.isStandalone ? null : push.subscribed ? (
            <button className="btn-secondary h-9 text-xs" type="button" onClick={push.unsubscribe} disabled={push.busy}>
              <BellOff size={14} /> Tắt thông báo
            </button>
          ) : (
            <button
              className="btn-primary h-9 text-xs"
              type="button"
              onClick={push.subscribe}
              disabled={push.busy || !push.supported || !push.configured}
            >
              <Bell size={14} /> Bật thông báo
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

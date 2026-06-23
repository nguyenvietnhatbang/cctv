"use client";

import { Bell, BellOff, CheckCircle2, Download, Smartphone } from "lucide-react";
import type { PwaPushController } from "@/components/ops/use-pwa-push";

export function PwaPushSettings({ push }: { push: PwaPushController }) {
  const status = push.subscribed
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
              Cài lên màn hình chính để mở nhanh và nhận cập nhật công việc khi không mở web.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              {push.subscribed ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Bell size={14} />}
              {status}
            </p>
            {push.isIOS && !push.isStandalone ? (
              <p className="mt-2 text-xs text-amber-700">
                iPhone/iPad: bấm Chia sẻ → Thêm vào Màn hình chính, sau đó mở ứng dụng từ biểu tượng.
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
          {push.subscribed ? (
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

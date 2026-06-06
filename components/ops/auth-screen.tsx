"use client";

import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { Field, PendingButton, ValidatedForm } from "@/components/ops/ui";

export function AuthScreen({
  error,
  onLogin,
}: {
  error: string | null;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    try {
      await onLogin(event);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_28%),linear-gradient(135deg,#f8fafc,#eef2ff_45%,#ecfeff)] px-4 py-8">
      <ValidatedForm onSubmit={submit} className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">CCTV Ops</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Đăng nhập hệ thống</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Đăng nhập với tài khoản quản trị hoặc kỹ thuật để quản lý công việc và vật tư. Liên hệ admin nếu bạn chưa có tài khoản.
          </p>
        </div>
        <div className="grid gap-4">
          <Field label="Email hoặc số điện thoại">
            <input name="identifier" className="input" autoComplete="username" required />
          </Field>
          <Field label="Mật khẩu">
            <input name="password" type="password" className="input" autoComplete="current-password" required />
          </Field>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <PendingButton className="btn-primary h-11" type="submit" pending={submitting} pendingLabel="Đang đăng nhập...">
            <LogIn size={16} />
            Đăng nhập
          </PendingButton>
        </div>
      </ValidatedForm>
    </main>
  );
}

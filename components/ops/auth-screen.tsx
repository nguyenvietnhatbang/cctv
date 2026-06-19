"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { Field, PendingButton, ValidatedForm } from "@/components/ops/ui";
import { brandAssets, companyProfile } from "@/lib/company";

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
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8fafc,#eef2ff_48%,#ecfeff)] px-4 py-8">
      <ValidatedForm onSubmit={submit} className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <Image
            src={brandAssets.fullLogo}
            alt={companyProfile.legalName}
            width={360}
            height={158}
            priority
            className="mx-auto h-auto w-56 max-w-full"
          />
          <h1 className="mt-5 text-center text-2xl font-semibold text-zinc-950">Đăng nhập hệ thống</h1>
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

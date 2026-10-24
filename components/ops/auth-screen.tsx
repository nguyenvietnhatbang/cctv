"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck, Sun, Moon } from "lucide-react";
import { brandAssets, companyProfile } from "@/lib/company";

export function AuthScreen({
  error,
  onLogin,
}: {
  error: string | null;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Detect theme on mount from document element or localStorage
    const savedTheme = localStorage.getItem("cctv_theme");
    const currentTheme =
      document.documentElement.dataset.theme === "dark" || savedTheme === "dark"
        ? "dark"
        : "light";
    setTheme(currentTheme);
    document.documentElement.dataset.theme = currentTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("cctv_theme", nextTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", nextTheme === "dark" ? "#0f172a" : "#1d4ed8");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    try {
      await onLogin(event);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-[#0b1220] flex flex-col justify-center items-center px-4 py-8 sm:py-12 selection:bg-blue-500 selection:text-white transition-colors duration-200">
      {/* Theme Toggle Button (Light/Dark Mode) */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 transition-all text-xs font-semibold cursor-pointer active:scale-95"
          title={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <>
              <Sun size={15} className="text-amber-400" />
              <span>Chế độ sáng</span>
            </>
          ) : (
            <>
              <Moon size={15} className="text-slate-600" />
              <span>Chế độ tối</span>
            </>
          )}
        </button>
      </div>

      {/* Ambient background blur blobs - Mobile App Style */}
      <div
        className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full bg-blue-300/40 dark:bg-blue-600/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-teal-200/50 dark:bg-teal-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-indigo-200/35 dark:bg-indigo-600/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
        {/* Large Brand Logo & Subtitle - No box, No border */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="relative mb-3 flex items-center justify-center">
            <Image
              src={brandAssets.fullLogo}
              alt={companyProfile.legalName}
              width={360}
              height={158}
              priority
              className="h-auto w-52 sm:w-60 max-w-full object-contain drop-shadow-sm transition-transform hover:scale-[1.02]"
            />
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Hệ thống Quản lý Vận hành CCTV
          </p>
        </div>

        {/* Floating Modern Form Card - Completely Borderless */}
        <div className="w-full rounded-[2rem] bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl shadow-slate-200/60 dark:shadow-2xl dark:shadow-black/40 backdrop-blur-md">
          <form onSubmit={submit} className="grid gap-4 sm:gap-5">
            {/* Email / Phone Field */}
            <div className="grid gap-1.5">
              <label
                htmlFor="identifier"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Tài khoản hoặc SĐT
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-4 text-slate-400 dark:text-slate-500">
                  <Mail size={18} />
                </span>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={submitting}
                  placeholder="name@anviettech.vn hoặc SĐT"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="grid gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Mật khẩu
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-4 text-slate-400 dark:text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 pl-11 pr-11 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 transition"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error ? (
              <div
                className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 px-3.5 py-3 text-xs font-semibold text-red-700 dark:text-red-400"
                role="alert"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="leading-5">{error}</span>
              </div>
            ) : null}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 h-12 w-full rounded-2xl bg-slate-700 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-700/15 dark:shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Help Note - Borderless */}
          <div className="mt-5 pt-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quên mật khẩu? Vui lòng liên hệ <span className="font-semibold text-slate-700 dark:text-slate-300">Quản trị viên</span> để cấp lại.
            </p>
          </div>
        </div>

        {/* Internal Portal Notice */}
        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck size={14} className="text-slate-400 dark:text-slate-500" />
          <span>Hệ thống nội bộ · Bảo mật 2 lớp</span>
        </div>
      </div>
    </main>
  );
}

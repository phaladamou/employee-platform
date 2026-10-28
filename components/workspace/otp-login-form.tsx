// components/workspace/otp-login-form.tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function OtpLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const tErr = useTranslations("auth.errors");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const secondsLeft =
    expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn =
    cooldownUntil === null
      ? 0
      : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  async function requestCode(targetEmail: string) {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (response.status === 429) {
        const data = (await response.json().catch(() => null)) as {
          retryAfterSeconds?: number;
        } | null;
        setCooldownUntil(
          Date.now() + (data?.retryAfterSeconds ?? 60) * 1000
        );
        setError(tErr("otp_rate_limited"));
        return false;
      }
      if (!response.ok) {
        setError(tErr("otp_request_failed"));
        return false;
      }
      const data = (await response.json()) as {
        expiresAt: string;
        cooldownSeconds: number;
      };
      setExpiresAt(new Date(data.expiresAt).getTime());
      setCooldownUntil(Date.now() + data.cooldownSeconds * 1000);
      setStep("code");
      return true;
    } catch {
      setError(tErr("network_error"));
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{7}$/.test(code.trim())) {
      setError(tErr("otp_invalid"));
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await signIn("otp", {
        email,
        code: code.trim(),
        redirect: false,
      });
      if (result?.error) {
        setError(tErr("otp_invalid"));
        return;
      }
      setIsRedirecting(true);
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(tErr("network_error"));
    } finally {
      setIsBusy(false);
    }
  }

  if (isRedirecting) {
    return (
      <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-foreground" />
        <p className="text-[13px] text-muted-foreground">{t("pleaseWait")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center text-[12.5px] font-medium text-foreground">
        {t("otpTitle")}
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}

      {step === "email" ? (
        <>
          <Input
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            type="email"
            value={email}
            className="
              h-11 rounded-lg border-none bg-muted/40
              px-4 text-[13px] text-foreground
              shadow-none outline-none
              placeholder:text-muted-foreground/60
              transition-colors
              focus-visible:bg-muted/60
              focus-visible:ring-0
            "
          />
          <Button
            className="
              mt-1.5 h-11 w-full cursor-pointer
              rounded-lg bg-foreground text-[13px] font-medium text-background
              shadow-none transition-colors duration-150
              hover:bg-foreground/90
              disabled:cursor-not-allowed disabled:opacity-80
            "
            disabled={isBusy || email.trim().length === 0}
            onClick={() => requestCode(email)}
            type="button"
          >
            {isBusy ? t("pleaseWait") : t("otpSendCode")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-center text-[12px] text-muted-foreground">
            {t("otpSentTo", { email })}
          </p>
          <Input
            autoComplete="one-time-code"
            autoFocus
            inputMode="numeric"
            maxLength={7}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 7))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                verifyCode();
              }
            }}
            placeholder={t("otpCodePlaceholder")}
            type="text"
            value={code}
            className="
              h-12 rounded-lg border-none bg-muted/40
              px-4 text-center text-[20px] font-semibold tracking-[0.3em] text-foreground
              shadow-none outline-none
              placeholder:text-[13px] placeholder:font-normal placeholder:tracking-normal
              placeholder:text-muted-foreground/60
              transition-colors
              focus-visible:bg-muted/60
              focus-visible:ring-0
            "
          />
          <p className="text-center text-[12px] tabular-nums text-muted-foreground">
            {secondsLeft > 0
              ? t("otpExpiresIn", { time: formatCountdown(secondsLeft) })
              : t("otpExpired")}
          </p>
          <Button
            className="
              mt-1.5 h-11 w-full cursor-pointer
              rounded-lg bg-foreground text-[13px] font-medium text-background
              shadow-none transition-colors duration-150
              hover:bg-foreground/90
              disabled:cursor-not-allowed disabled:opacity-80
            "
            disabled={isBusy || code.trim().length !== 7}
            onClick={verifyCode}
            type="button"
          >
            {isBusy ? t("pleaseWait") : t("otpVerify")}
          </Button>
          <div className="mt-1 flex items-center justify-between">
            <button
              className="
                text-[11px] text-muted-foreground/70
                transition-colors hover:text-foreground
              "
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              type="button"
            >
              {t("otpChangeEmail")}
            </button>
            <button
              className="
                text-[11px] text-muted-foreground/70
                transition-colors hover:text-foreground
                disabled:cursor-not-allowed disabled:opacity-50
              "
              disabled={isBusy || resendIn > 0}
              onClick={() => requestCode(email)}
              type="button"
            >
              {resendIn > 0
                ? t("otpResendWait", { time: formatCountdown(resendIn) })
                : t("otpResend")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

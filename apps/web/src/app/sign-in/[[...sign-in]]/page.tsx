"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Step = "details" | "verify";

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isSubmitting = fetchStatus === "fetching";

  useEffect(() => {
    if (isSignedIn) router.replace("/");
  }, [isSignedIn, router]);

  function navigateHome() {
    return signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/");
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          router.push(url);
        }
      }
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError(error.longMessage ?? error.message);
      return;
    }

    if (signIn.status === "complete") {
      await navigateHome();
      return;
    }

    if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
      const emailCodeFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "email_code"
      );
      if (emailCodeFactor) {
        const { error: mfaError } = await signIn.mfa.sendEmailCode();
        if (mfaError) {
          setFormError(mfaError.longMessage ?? mfaError.message);
          return;
        }
        setStep("verify");
        return;
      }
    }

    setFormError("We couldn't sign you in with just email and password. Please try again.");
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) {
      setFormError(error.longMessage ?? error.message);
      return;
    }

    if (signIn.status === "complete") {
      await navigateHome();
    } else {
      setFormError("Verification failed. Please try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
            <Sparkles size={18} />
          </div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            {step === "details" ? "Welcome back" : "Verify it's you"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {step === "details"
              ? "Sign in with your email and password."
              : `Enter the 6-digit code we sent to ${emailAddress}`}
          </p>
        </div>

        {step === "details" ? (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field
              label="Email address"
              icon={<Mail size={14} />}
              error={errors.fields.identifier?.longMessage ?? errors.fields.identifier?.message}
            >
              <input
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                value={emailAddress}
                onChange={(event) => setEmailAddress(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              icon={<Lock size={14} />}
              error={errors.fields.password?.longMessage ?? errors.fields.password?.message}
            >
              <input
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {formError ? <p className="text-sm text-[var(--danger)]">{formError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleVerify}>
            <Field
              label="Verification code"
              icon={<KeyRound size={14} />}
              error={errors.fields.code?.longMessage ?? errors.fields.code?.message}
            >
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                className={inputClass}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
              />
            </Field>
            {formError ? <p className="text-sm text-[var(--danger)]">{formError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={() => signIn.mfa.sendEmailCode()}
              className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Resend code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-[var(--accent)]">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

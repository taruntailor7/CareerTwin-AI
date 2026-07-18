"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Step = "details" | "verify";

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
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
    return signUp.finalize({
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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Only email + password are ever sent, so phone number is never part of this flow.
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setFormError(error.longMessage ?? error.message);
      return;
    }

    if (signUp.status === "complete") {
      await navigateHome();
      return;
    }

    if (signUp.missingFields.length > 0) {
      setFormError(
        `Sign-up can't complete because your Clerk instance still requires: ${signUp.missingFields.join(", ")}. Disable that requirement in the Clerk Dashboard to fix this.`
      );
      return;
    }

    const { error: codeError } = await signUp.verifications.sendEmailCode();
    if (codeError) {
      setFormError(codeError.longMessage ?? codeError.message);
      return;
    }
    setStep("verify");
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(error.longMessage ?? error.message);
      return;
    }

    if (signUp.status !== "complete") {
      setFormError("We couldn't finish creating your account. Please try again.");
      return;
    }

    await navigateHome();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
            <Sparkles size={18} />
          </div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            {step === "details" ? "Create your CareerTwin" : "Verify your email"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {step === "details"
              ? "Just an email and password — nothing else required."
              : `Enter the 6-digit code we sent to ${emailAddress}`}
          </p>
        </div>

        {step === "details" ? (
          <form className="flex flex-col gap-4" onSubmit={handleCreate}>
            <Field
              label="Email address"
              icon={<Mail size={14} />}
              error={errors.fields.emailAddress?.longMessage ?? errors.fields.emailAddress?.message}
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
              hint="At least 8 characters."
              error={errors.fields.password?.longMessage ?? errors.fields.password?.message}
            >
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {/* Invisible bot-protection widget Clerk requires for custom sign-up flows */}
            <div id="clerk-captcha" />
            {formError ? <p className="text-sm text-[var(--danger)]">{formError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? "Creating account…" : "Create account"}
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
              onClick={() => signUp.verifications.sendEmailCode()}
              className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Resend code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-[var(--accent)]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", organizationName: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    const add = (field: string, message: string) => {
      (errors[field] ??= []).push(message);
    };

    if (!form.name.trim()) add("name", "Name is required.");
    else if (form.name.trim().length > 255) add("name", "Name must be 255 characters or fewer.");

    if (!form.organizationName.trim()) add("organizationName", "Organization name is required.");
    else if (form.organizationName.trim().length > 255) {
      add("organizationName", "Organization name must be 255 characters or fewer.");
    }

    if (!form.email.trim()) add("email", "Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      add("email", "Enter a valid email address.");
    }

    if (!form.password) add("password", "Password is required.");
    else if (form.password.length < 8) add("password", "Password must be at least 8 characters.");
    else if (form.password.length > 128) add("password", "Password must be 128 characters or fewer.");

    return errors;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validationErrors = validate();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const legacyRecovery = await register({
        name: form.name.trim(),
        email,
        organizationName: form.organizationName.trim(),
        password: form.password,
      });
      // New registrations have no session until verification. Legacy unverified accounts use the existing authenticated recovery flow.
      if (!legacyRecovery) sessionStorage.setItem("taskflow.pendingRegistrationEmail", email);
      else sessionStorage.removeItem("taskflow.pendingRegistrationEmail");
      router.replace("/verify-email");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else if (err instanceof ApiError && err.code === "EMAIL_IN_USE") {
        setFieldErrors({ email: ["An account with this email already exists."] });
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tf-slide-in">
      <h1 className="font-display text-[24px] font-bold text-ink">Create your workspace</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">
        This creates a brand-new organization with you as its admin.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" required aria-invalid={!!fieldErrors.name?.length} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ava Shah" />
          <FieldError>{fieldErrors.name?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            id="organizationName"
            required
            aria-invalid={!!fieldErrors.organizationName?.length}
            value={form.organizationName}
            onChange={(e) => set("organizationName", e.target.value)}
            placeholder="Northstar Labs"
          />
          <FieldError>{fieldErrors.organizationName?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!fieldErrors.email?.length}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
          />
          <FieldError>{fieldErrors.email?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!fieldErrors.password?.length}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="••••••••"
          />
          <FieldError>{fieldErrors.password?.[0]}</FieldError>
        </div>

        {error && Object.keys(fieldErrors).length === 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Create account
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X, Mail, Lock, ArrowLeft } from "lucide-react";
import { loginWithEmail, loginWithGoogle, sendPasswordResetToEmail } from "@/lib/auth";
import { firebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { isRegistrationOpen } from "@/lib/registrationOpen";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Set when opening from `/?login=1&reset=1` */
  initialView?: "signin" | "forgot";
}

export default function AuthModal({ isOpen, onClose, initialView = "signin" }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<"signin" | "forgot">("signin");

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setErrors({});
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const validateSignIn = () => {
    const e: Record<string, string> = {};
    const email = form.email.trim();
    if (!/\S+@\S+\.\S+/.test(email)) e.email = "Valid email is required";
    if (!form.password.trim()) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateEmailOnly = () => {
    const e: Record<string, string> = {};
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateSignIn()) return;
    setLoading(true);
    try {
      await loginWithEmail(form.email.trim(), form.password);
      toast.success("Welcome back!");
      onClose();
    } catch (err: unknown) {
      const error = err as { code?: string };
      toast.error(
        error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential"
          ? "Invalid email or password"
          : firebaseAuthErrorMessage(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateEmailOnly()) return;
    setResetSending(true);
    try {
      await sendPasswordResetToEmail(form.email.trim());
      toast.success(
        "If an account exists for that email, we sent a link to reset your password. Check your inbox and spam folder."
      );
      setView("signin");
    } catch (err) {
      toast.error(firebaseAuthErrorMessage(err));
    } finally {
      setResetSending(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const cred = await loginWithGoogle();
      if (cred) {
        toast.success("Signed in with Google!");
        onClose();
      }
      /* Mobile: signInWithRedirect — page navigates away; no toast here */
    } catch (err) {
      console.error(err);
      toast.error(firebaseAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  if (view === "forgot") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-[#0d1a0d] border border-green-500/25 rounded-2xl w-full max-w-sm p-8 shadow-2xl shadow-green-500/5">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-500/40 rounded-tl-2xl" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-500/40 rounded-br-2xl" />

          <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>

          <div className="mb-6">
            <p className="font-mono text-xs text-green-500/50 tracking-widest mb-1">// auth.reset</p>
            <h2 className="text-2xl font-extrabold text-white">Reset password</h2>
            <p className="text-sm text-gray-400 mt-2 font-mono leading-relaxed">
              For <span className="text-gray-300">email and password</span> accounts, enter your email and we’ll send a link to
              set a new password. Google sign-in users don’t use a DevCamp password — use “Continue with Google” instead.
            </p>
          </div>

          <form onSubmit={handleSendReset} className="space-y-3">
            <Input
              id="reset-email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              icon={<Mail size={15} />}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
            />
            <Button type="submit" loading={resetSending} className="w-full !mt-4" size="lg">
              Send reset link
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setView("signin"); setErrors({}); }}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white mt-5 font-mono"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#0d1a0d] border border-green-500/25 rounded-2xl w-full max-w-sm p-8 shadow-2xl shadow-green-500/5">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-500/40 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-500/40 rounded-br-2xl" />

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>

        {/* Logo + header */}
        <div className="flex flex-col items-center mb-7">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-green-500/20 blur-lg scale-110" />
            <Image src="/logo.png" alt="AI DevCamp" width={68} height={68} className="relative rounded-2xl ring-1 ring-green-500/30" />
          </div>
          <p className="font-mono text-xs text-green-500/50 tracking-widest mb-1">// auth.login</p>
          <h2 className="text-2xl font-extrabold text-white">Welcome back</h2>
          <p className="text-sm text-gray-400 mt-1 font-mono">$ signin --access dashboard</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 mb-4 text-sm"
        >
          {googleLoading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-600 font-mono">or email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input id="email" type="email" label="Email Address" placeholder="you@example.com"
            icon={<Mail size={15} />} value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => { setView("forgot"); setErrors({}); }}
                className="text-xs text-green-400/90 hover:text-green-300 font-mono shrink-0"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={15} />
              </div>
              <input
                id="password"
                type="password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`w-full bg-white/5 border rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                  errors.password ? "border-red-500 focus:ring-red-500" : "border-white/10"
                }`}
              />
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
          </div>
          <Button type="submit" loading={loading} className="w-full !mt-4" size="lg">
            Sign In →
          </Button>
        </form>

        {isRegistrationOpen() ? (
          <p className="text-center text-sm text-gray-500 mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/register" onClick={onClose} className="text-green-400 hover:text-green-300 font-semibold">
              Register
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm text-gray-500 mt-5">
            New registrations are closed. Sign in with your existing DevCamp account.
          </p>
        )}
      </div>
    </div>
  );
}

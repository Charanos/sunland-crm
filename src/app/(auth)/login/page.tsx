"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  IconEye,
  IconEyeOff,
  IconMail,
  IconShieldLock,
  IconArrowRight,
  IconLoader2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EMULATION_PROFILES = [
  {
    role: "ceo",
    name: "Paul Amos",
    title: "Chief Executive Officer",
    initials: "PA",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  },
  {
    role: "general_manager",
    name: "Grace Mutua",
    title: "General Manager",
    initials: "GM",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
  },
  {
    role: "finance_head",
    name: "Dennis Munge",
    title: "Head of Finance",
    initials: "DM",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  },
  {
    role: "hr_head",
    name: "Cody Fisher",
    title: "Head of Human Resources",
    initials: "CF",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
  },
  {
    role: "line_manager",
    name: "Jared Omondi",
    title: "Line Manager / Business Dev",
    initials: "JO",
    avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=face",
  },
  {
    role: "front_office_head",
    name: "Sharon Koech",
    title: "Front Office Lead",
    initials: "SK",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
  },
];

const EMAIL_TO_ROLE: Record<string, string> = {
  "ceo@sunlandre.co.ke": "ceo",
  "gm@sunlandre.co.ke": "general_manager",
  "finance.head@sunlandre.co.ke": "finance_head",
  "hr.head@sunlandre.co.ke": "hr_head",
  "line.manager@sunlandre.co.ke": "line_manager",
  "front.office@sunlandre.co.ke": "front_office_head",
};

export default function LoginPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("ceo@sunlandre.co.ke");
  const [password, setPassword] = useState("sunland-demo");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved credentials if rememberMe was previously set
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("sunland_remembered_email");
      const savedRemember = localStorage.getItem("sunland_remember_me");
      if (savedEmail) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmail(savedEmail);
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }
    }
  }, []);

  const handleEmulate = async (role: string) => {
    setLoadingRole(role);
    setError(null);

    // Persist email locally if rememberMe checkbox is active
    if (typeof window !== "undefined") {
      if (rememberMe) {
        localStorage.setItem("sunland_remembered_email", email);
        localStorage.setItem("sunland_remember_me", "true");
      } else {
        localStorage.removeItem("sunland_remembered_email");
        localStorage.setItem("sunland_remember_me", "false");
      }
    }

    try {
      const res = await fetch("/api/auth/emulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success && data.user?.portal) {
        window.location.href = data.user.portal;
      } else {
        setError(data.error || "Access delegation failed");
        setLoadingRole(null);
      }
    } catch (e) {
      console.error(e);
      setError("An unexpected error occurred during portal routing.");
      setLoadingRole(null);
    }
  };

  const handleStaticSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = EMAIL_TO_ROLE[email.toLowerCase().trim()] || "ceo";
    handleEmulate(role);
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      {/* Hero Side (Hidden on Mobile) */}
      <section className="relative hidden min-h-screen overflow-hidden lg:block bg-[#151936]">
        <Image
          alt="Warm modern property exterior"
          className="object-cover opacity-75"
          fill
          priority
          sizes="50vw"
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80"
        />
        {/* Sleek overlay gradients to ensure optimal readability for the text and logo branding */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#151936] via-[#151936]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#151936]/50 via-transparent to-transparent" />

        {/* Brand Logo in the left panel */}
        <div className="absolute left-12 top-12 flex items-center gap-3">
          <Image
            src="/logo.png"
            width={180}
            height={156}
            alt="Sunland Logo"
            className="h-25 w-auto brightness-0 invert"
          />
        </div>

        {/* Refined copy with Cormorant Garamond title-serif */}
        <div className="absolute bottom-16 left-12 max-w-md text-white animate-fade-in-up">
          <h2 className="title-serif font-normal text-white leading-tight">Where Life Meets Style.</h2>
          <p className="body-md mt-4 text-slate-200/80 leading-relaxed font-sans">
            Proprietary estate intelligence system managing listings, contracts, tenants, human resources, and the core general ledger.
          </p>
        </div>
      </section>

      {/* Form Side */}
      <section className="flex min-h-screen items-center justify-center bg-slate-50/20 px-6 py-12 lg:bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo container - Hidden on Desktop, visible on Mobile inside a brand-dark card badge for visibility */}
          <div className="mb-10 flex justify-center lg:hidden">
            <div className="bg-[#151936] px-5 py-3 rounded-xl shadow-md border border-white/[0.04]">
              <Image
                src="/logo.png"
                width={130}
                height={40}
                alt="Sunland Logo"
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Badge tone="brand" className="gap-1.5 px-3 py-1">
              <IconShieldLock size={12} />
              <span>Secure Gateway</span>
            </Badge>
            <h1 className="title-serif font-normal text-[#151936] mt-4">
              Welcome back to Sunland
            </h1>
            <p className="body-sm text-slate-500">
              Sign in to your internal operations workspace.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleStaticSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-rose-700 animate-scale-in text-sm">
                <span className="size-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="body-sm text-slate-600">Email Address</span>
              <span className="relative mt-2 block">
                <IconMail
                  aria-hidden
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  className="focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-3 text-sm transition-all focus:border-[#f3df27] focus:ring-1 focus:ring-[#f3df27] disabled:opacity-50 disabled:bg-slate-50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loadingRole !== null}
                  required
                  type="email"
                />
              </span>
            </label>

            <label className="block">
              <span className="body-sm text-slate-600">Password</span>
              <span className="relative mt-2 block">
                <IconShieldLock
                  aria-hidden
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  className="focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-11 text-sm transition-all focus:border-[#f3df27] focus:ring-1 focus:ring-[#f3df27] disabled:opacity-50 disabled:bg-slate-50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loadingRole !== null}
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="focus-ring absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  onClick={() => setShowPassword((p) => !p)}
                  disabled={loadingRole !== null}
                  type="button"
                >
                  {showPassword ? <IconEyeOff aria-hidden size={18} /> : <IconEye aria-hidden size={18} />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between text-slate-500 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  className="size-4 rounded border-slate-300 accent-[#f3df27] focus:ring-[#f3df27] disabled:opacity-50"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loadingRole !== null}
                  type="checkbox"
                />
                Remember me
              </label>
              <Link className="hover:text-[#151936] hover:underline" href="/login">
                Forgot password?
              </Link>
            </div>

            <Button
              className="w-full h-auto py-2.5 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] border-none font-mono transition-colors duration-200 disabled:opacity-60 flex items-center justify-center gap-2 label-caps"
              type="submit"
              disabled={loadingRole !== null}
            >
              {loadingRole === "ceo" ? (
                <>
                  <IconLoader2 className="animate-spin" size={18} />
                  Authenticating...
                </>
              ) : (
                "Login to Portal"
              )}
            </Button>
          </form>

          {/* Authorized Workspace Portals (Access Delegation Control) */}
          <div className="mt-10 border-t border-slate-100 pt-8">
            <div className="flex items-center gap-2">
              <span className="flex size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-mono text-slate-400 label-caps">
                Authorized Workspace Portals
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
              Select an approved operational profile below to verify direct portal routing and role-based permissions.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {EMULATION_PROFILES.map((profile) => (
                <button
                  key={profile.role}
                  disabled={loadingRole !== null}
                  onClick={() => handleEmulate(profile.role)}
                  className="group flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-3.5 text-left transition duration-200 hover:border-slate-400 hover:shadow-[0_4px_12px_rgba(21,25,54,0.04)] disabled:opacity-50"
                >
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-50">
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name}
                      fill
                      sizes="36px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 transition group-hover:text-[#151936] text-sm">{profile.name}</p>
                    <p className="truncate text-slate-400 font-mono uppercase tracking-wide mt-0.5 text-sm">{profile.title}</p>
                  </div>
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#151936]/5 group-hover:text-[#151936] transition duration-200">
                    <IconArrowRight size={11} stroke={2.5} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Footnote Sandbox Link */}
          <div className="mt-8 flex justify-center border-t border-slate-100 pt-6">
            <Link
              className="font-mono text-slate-400 hover:text-slate-600 hover:underline label-caps"
              href="/admin"
            >
              System Sandbox Bypass: View Shell
            </Link>
          </div>
        </div>
      </section>

      {/* Secure Session Redirection Overlay */}
      {loadingRole && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#151936]/90 backdrop-blur-sm text-white animate-fade-in">
          <div className="flex flex-col items-center max-w-full px-6 text-center">
            <div className="relative mb-6">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full border border-[#f3df27]/25 animate-ping" />
              {/* Central Shield Lock icon */}
              <div className="flex size-14 items-center justify-center rounded-full border border-[#f3df27]/30 bg-[#151936] shadow-xl">
                <IconShieldLock size={28} className="text-[#f3df27] animate-pulse" />
              </div>
            </div>

            <h3 className="title-serif font-normal text-white">Delegating Authority</h3>
            <p className="body-sm mt-2 text-slate-300 leading-relaxed">
              Establishing a secure workspace session for the {EMULATION_PROFILES.find(p => p.role === loadingRole)?.title || "Administrator"} portal.
            </p>

            <div className="mt-8 flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5">
              <IconLoader2 className="animate-spin text-[#f3df27]" size={12} />
              <span className="font-mono text-[#f3df27] label-caps">
                Routing Secure Session...
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

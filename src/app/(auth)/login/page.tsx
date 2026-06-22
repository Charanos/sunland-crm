"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { IconBuildingEstate, IconEye, IconMail, IconShieldLock, IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const EMULATION_PROFILES = [
  { role: "ceo", name: "Paul Amos", title: "Chief Executive Officer", initials: "PA" },
  { role: "general_manager", name: "Grace Mutua", title: "General Manager", initials: "GM" },
  { role: "finance_head", name: "Dennis Munge", title: "Head of Finance", initials: "DM" },
  { role: "hr_head", name: "Cody Fisher", title: "Head of Human Resources", initials: "CF" },
  { role: "line_manager", name: "Jared Omondi", title: "Line Manager / Business Dev", initials: "JO" },
  { role: "front_office_head", name: "Sharon Koech", title: "Front Office Lead", initials: "SK" },
];

export default function LoginPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleEmulate = async (role: string) => {
    setLoadingRole(role);
    try {
      const res = await fetch("/api/auth/emulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success && data.user?.portal) {
        window.location.href = data.user.portal;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRole(null);
    }
  };

  const handleStaticSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleEmulate("ceo");
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          alt="Warm modern property exterior"
          className="object-cover"
          fill
          priority
          sizes="50vw"
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute left-10 top-10 flex items-center gap-3 text-white">
          <div className="flex size-10 items-center justify-center rounded-full bg-white text-black">
            <IconBuildingEstate aria-hidden size={21} />
          </div>
          <span className="text-lg font-medium">Sunland ERP</span>
        </div>
        <div className="absolute bottom-12 left-10 max-w-md text-white">
          <p className="title-serif text-white">Where Life Meets Style.</p>
          <p className="body-md mt-3 text-white/82">
            Internal estate intelligence for pipeline, properties, leases, and
            finance.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
                <IconBuildingEstate aria-hidden size={21} />
              </div>
              <span className="text-lg font-medium">Sunland ERP</span>
            </div>
            <Link
              className="ml-auto rounded-full bg-black px-5 py-2 text-sm  font-medium text-white"
              href="/admin"
            >
              View shell
            </Link>
          </div>

          <p className="label-caps text-[var(--on-surface-dim)]">
            Secure access
          </p>
          <h1 className="headline-lg mt-3">Welcome back to Sunland ERP</h1>
          <p className="body-sm mt-2 text-[var(--on-surface-dim)]">
            Sign in to your internal operations workspace.
          </p>

          <form onSubmit={handleStaticSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="body-sm text-[var(--on-surface)]">Email</span>
              <span className="relative mt-2 block">
                <IconMail
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-dim)]"
                  size={18}
                />
                <input
                  className="focus-ring h-11 w-full rounded-lg border border-[var(--outline-strong)] bg-white pl-10 pr-3 text-sm "
                  defaultValue="ceo@sunlandre.co.ke"
                  type="email"
                />
              </span>
            </label>

            <label className="block">
              <span className="body-sm text-[var(--on-surface)]">Password</span>
              <span className="relative mt-2 block">
                <IconShieldLock
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-dim)]"
                  size={18}
                />
                <input
                  className="focus-ring h-11 w-full rounded-lg border border-[var(--outline-strong)] bg-white pl-10 pr-11 text-sm "
                  defaultValue="sunland-demo"
                  type="password"
                />
                <button
                  aria-label="Show password"
                  className="focus-ring absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--on-surface-dim)]"
                  type="button"
                >
                  <IconEye aria-hidden size={18} />
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between body-sm">
              <label className="flex items-center gap-2">
                <input
                  className="size-4 accent-[var(--primary)]"
                  defaultChecked
                  type="checkbox"
                />
                Remember me
              </label>
              <Link className="text-[var(--on-surface-dim)]" href="/login">
                Forgot password?
              </Link>
            </div>

            <Button className="w-full" type="submit">
              Login
            </Button>
          </form>

          {/* Authorized Workspace Portals (Access Delegation Control) */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-[var(--success)] animate-pulse" />
              <h2 className="text-base font-medium uppercase tracking-wider text-slate-400">
                Authorized Workspace Portals
              </h2>
            </div>
            <p className="mt-1.5 text-base text-slate-500 leading-relaxed">
              Select an approved operational profile below to verify direct portal routing and role-based permissions.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {EMULATION_PROFILES.map((profile) => (
                <button
                  key={profile.role}
                  disabled={loadingRole !== null}
                  onClick={() => handleEmulate(profile.role)}
                  className="group flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-3.5 text-left transition duration-200 hover:border-slate-350 hover:shadow-[0_6px_16px_rgba(0,0,0,0.03)] disabled:opacity-50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base font-medium text-slate-600 font-mono transition group-hover:bg-[#151936]/5 group-hover:text-[#151936]">
                    {profile.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800 transition group-hover:text-slate-950">{profile.name}</p>
                    <p className="truncate text-sm text-slate-400 mt-0.5">{profile.title}</p>
                  </div>
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#151936]/10 group-hover:text-[#151936] transition duration-200">
                    <IconArrowRight size={11} stroke={2.5} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

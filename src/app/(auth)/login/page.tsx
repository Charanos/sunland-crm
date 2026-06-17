import Image from "next/image";
import Link from "next/link";
import { IconBuildingEstate, IconEye, IconMail, IconShieldLock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
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
          <span className="text-lg font-medium">Sunland CRM</span>
        </div>
        <div className="absolute bottom-12 left-10 max-w-md text-white">
          <p className="title-serif">Where Life Meets Style.</p>
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
              <span className="text-lg font-medium">Sunland CRM</span>
            </div>
            <Link
              className="ml-auto rounded-full bg-black px-5 py-2 text-sm font-medium text-white"
              href="/admin"
            >
              View shell
            </Link>
          </div>

          <p className="label-caps text-[var(--on-surface-dim)]">
            Secure access
          </p>
          <h1 className="headline-lg mt-3">Welcome back to Sunland CRM</h1>
          <p className="body-sm mt-2 text-[var(--on-surface-dim)]">
            Sign in to your internal operations workspace.
          </p>

          <form className="mt-8 space-y-5">
            <label className="block">
              <span className="body-sm text-[var(--on-surface)]">Email</span>
              <span className="relative mt-2 block">
                <IconMail
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-dim)]"
                  size={18}
                />
                <input
                  className="focus-ring h-11 w-full rounded-lg border border-[var(--outline-strong)] bg-white pl-10 pr-3 text-sm"
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
                  className="focus-ring h-11 w-full rounded-lg border border-[var(--outline-strong)] bg-white pl-10 pr-11 text-sm"
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
        </div>
      </section>
    </main>
  );
}

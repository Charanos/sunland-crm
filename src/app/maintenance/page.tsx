import Link from "next/link";
import { IconArrowRight, IconTool } from "@tabler/icons-react";
import { getMaintenanceMode } from "@/lib/services/system-ops";

/**
 * Where proxy.ts sends everyone except super-admins while maintenance mode is
 * on (ADR 020). Deliberately dependency-light: no app shell, no data fetching
 * beyond the notice itself, so it still renders when the thing under
 * maintenance is the app.
 *
 * If the flag is switched off, proxy.ts redirects anyone sitting here back to
 * their portal, so this page never becomes a stale dead end.
 */
export default async function MaintenancePage() {
  let message = "";
  try {
    const state = await getMaintenanceMode("group");
    message = state.message;
  } catch {
    // The notice must render even if the flag can't be read.
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[#f4f6f0]">
      <div className="w-full max-w-lg text-center">
        <span
          className="mx-auto flex size-16 items-center justify-center rounded-2xl text-[#f3df27]"
          style={{ background: "linear-gradient(135deg,#0c1f24 0%,#122a20 50%,#1e1b4b 100%)" }}
        >
          <IconTool size={30} />
        </span>

        <h1 className="title-serif mt-6 text-slate-900">We&apos;ll be right back</h1>

        <p className="mt-3 text-base leading-relaxed text-slate-500">
          {message?.trim()
            ? message
            : "Sunland ERP is under scheduled maintenance. Your data is safe and nothing you have submitted has been lost."}
        </p>

        <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <p className="label-caps text-slate-400">What this means</p>
          <ul className="mt-2.5 flex flex-col gap-2 text-sm text-slate-600">
            <li>Sign-in and day-to-day pages are paused while the work completes.</li>
            <li>Nothing in progress was discarded — records stay exactly as you left them.</li>
            <li>Access returns automatically the moment maintenance mode is switched off.</li>
          </ul>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          Need something urgently? Contact the CEO&apos;s office directly.
        </p>

        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#122a20] hover:underline"
        >
          Try again <IconArrowRight size={15} />
        </Link>
      </div>
    </main>
  );
}

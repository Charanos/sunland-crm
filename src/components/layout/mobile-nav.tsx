"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import { mobilePrimaryNav, navSections, getActiveNavItem } from "@/components/layout/nav-model";
import { TEAM_MEMBERS } from "./sunland-nav";

export function MobileBottomNav() {
  const pathname = usePathname();
  const activeNavItem = getActiveNavItem(pathname);

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed bottom-4 left-1/2 z-30 flex w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between rounded-full border border-black/5 bg-white/90 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:hidden"
    >
      {mobilePrimaryNav.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeNavItem?.href === item.href;

        return (
          <Link
            aria-label={item.label}
            className={cn(
              "focus-ring relative flex size-11 items-center justify-center rounded-full text-[var(--on-surface-dim)] transition",
              isActive && "text-white",
            )}
            href={item.href}
            key={item.href}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-bottom-nav-active"
                className="absolute inset-0 rounded-full bg-[var(--sidebar)] shadow-md"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              <IconComponent aria-hidden size={20} stroke={1.8} />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigationDrawer() {
  const pathname = usePathname();
  const { closeMobileNav, mobileNavOpen, setSelectedChatDMId } = useUIStore();
  const activeNavItem = getActiveNavItem(pathname);

  if (!mobileNavOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden">
      <button
        aria-label="Close navigation backdrop"
        className="absolute inset-0 size-full cursor-default"
        onClick={closeMobileNav}
        type="button"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[min(22rem,92vw)] flex-col border-r border-white/5 bg-[var(--sidebar)] text-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-4">
          <Link href="/admin" onClick={closeMobileNav}>
            <img
              src="/logo.png"
              className="h-8 w-auto max-w-[160px] object-contain pl-1"
              alt="Sunland ERP Logo"
            />
          </Link>
          <IconButton
            aria-label="Close navigation"
            className="size-9 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={closeMobileNav}
          >
            <IconX aria-hidden size={16} />
          </IconButton>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
          <div className="space-y-6">
            {navSections.map((section) => (
              <section key={section.id}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px w-5 bg-white/10" />
                  <p className="label-caps tracking-widest text-white/60">{section.label}</p>
                </div>
                <div className="space-y-1 relative">
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = activeNavItem?.href === item.href;

                    return (
                      <Link
                        className={cn(
                          "focus-ring relative flex h-9.5 items-center gap-3 rounded-xl px-3 text-sm  text-white/80 transition",
                          "hover:text-white",
                          isActive && "text-white font-medium",
                        )}
                        href={item.href}
                        key={item.href}
                        onClick={closeMobileNav}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="mobile-drawer-active-pill"
                            className="absolute inset-0 rounded-xl bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/[0.05]"
                            initial={false}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-3 w-full">
                          <IconComponent aria-hidden size={17} stroke={1.8} />
                          {item.label}
                          {item.badge ? (
                            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-sm  text-white/70">
                              {item.badge}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* ── Divider ── */}
            <div className="my-2">
              <div className="h-px bg-white/10" />
            </div>

            {/* ── Team Section ── */}
            <div>
              <div className="flex items-center justify-between mb-2 pl-2 pr-1">
                <p className="label-caps tracking-widest text-white/60 text-sm uppercase font-medium">Team</p>
              </div>
              <div className="space-y-0.5">
                {TEAM_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      const nameMap: Record<string, string> = {
                        "Esther Howard": "dm1",
                        "Jacob Jones": "dm2",
                        "Cody Fisher": "dm3",
                      };
                      setSelectedChatDMId(nameMap[member.name] || "dm1");
                      closeMobileNav();
                    }}
                    className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04] text-left"
                  >
                    <Avatar
                      src={member.avatarUrl}
                      fallback={member.name.substring(0, 2)}
                      status={member.status}
                      className="size-8 shrink-0"
                    />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-base text-white/75 group-hover:text-white/95 transition-colors">
                        {member.name}
                      </p>
                      <p className="truncate text-sm text-white/40">{member.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </div>
  );
}

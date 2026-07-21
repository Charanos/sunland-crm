"use client";

import type { Icon } from "@tabler/icons-react";
import { IconArrowUpRight, IconMessageCircle, IconPhone } from "@tabler/icons-react";
import { Drawer } from "@/components/ui/erp-primitives";

export interface ProfilePeekInfoRow {
  icon: Icon;
  label: string;
  value: string;
}

export interface ProfilePeekData {
  contactId: string | null;
  name: string;
  photo: string | null;
  badge: string;
  phone?: string | null;
  info: ProfilePeekInfoRow[];
}

// The design's own bespoke mini-peek pattern - distinct from the full detail
// drawer/page. Triggered from a lead card or a Quick Connects row; "Open in
// spotlight" sets the board's selected contact rather than navigating away.
export function ContactProfilePeek({
  data,
  onClose,
  onOpenSpotlight,
}: {
  data: ProfilePeekData | null;
  onClose: () => void;
  onOpenSpotlight: () => void;
}) {
  return (
    <Drawer open={!!data} onClose={onClose} title={data?.name ?? "Profile"} width="24rem">
      {data && (
        <div className="flex flex-col gap-4 -mt-5 -mx-5">
          <div className="relative h-64 overflow-hidden shrink-0">
            {data.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo} alt={data.name} className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#122a20] to-[#1e1b4b]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#151936]/55 via-[#151936]/5 to-[#151936]/25" />
            <div className="absolute top-4 inset-x-0 text-center px-4">
              <p className="font-serif text-xl text-white drop-shadow-sm">{data.name}</p>
              <p className="mt-1 text-xs text-white/90 truncate px-3">{data.badge}</p>
            </div>
            {data.phone && (
              <div className="absolute bottom-3.5 inset-x-0 flex items-center justify-center gap-2">
                <a
                  href={`https://wa.me/${data.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message on WhatsApp"
                  className="size-9 rounded-full bg-white/95 hover:bg-white flex items-center justify-center text-[#151936] shadow-md transition-colors"
                >
                  <IconMessageCircle size={16} />
                </a>
                <a
                  href={`tel:${data.phone}`}
                  className="inline-flex items-center gap-1.5 bg-[#151936] text-white rounded-full px-4 py-2 text-xs font-medium shadow-md hover:bg-[#1d2347] transition-colors"
                >
                  <IconPhone size={14} /> Call
                </a>
              </div>
            )}
          </div>
          <div className="px-5 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">Main info</p>
              <div className="flex flex-col gap-1.5">
                {data.info.map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-full px-4 py-2">
                    <span className="size-8 rounded-full bg-[#f4f6f0] flex items-center justify-center text-[#151936] shrink-0">
                      <row.icon size={15} />
                    </span>
                    <span className="flex-1 text-xs text-slate-500">{row.label}</span>
                    <span className="text-xs font-medium text-slate-900 truncate max-w-[150px]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={onOpenSpotlight}
              className="flex items-center justify-center gap-2 bg-gradient-to-br from-[#122a20] to-[#1e1b4b] text-white rounded-2xl py-3 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Open in spotlight <IconArrowUpRight size={15} />
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

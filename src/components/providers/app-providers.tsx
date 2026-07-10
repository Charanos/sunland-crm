"use client";

import { useState } from "react";
import { Analytics } from '@vercel/analytics/next';
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ToastProvider } from "@/components/ui/toast-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}

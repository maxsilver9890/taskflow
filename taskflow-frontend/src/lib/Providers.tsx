"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ApiError } from "@/lib/api/errors";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't hammer the API for errors a retry cannot fix.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

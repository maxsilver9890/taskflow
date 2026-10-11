import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

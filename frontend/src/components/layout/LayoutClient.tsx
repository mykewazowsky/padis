"use client";

import { usePathname } from "next/navigation";
import SiteShell from "@/components/layout/SiteShell";

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const noShellRoutes = ["/login"];

  if (noShellRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return <SiteShell>{children}</SiteShell>;
}
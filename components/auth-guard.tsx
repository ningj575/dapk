"use client";

import { useAuthToken, useClientReady } from "@/components/auth-state";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useAuthToken();
  const ready = Boolean(useClientReady());
  const allowed = Boolean(token);

  useEffect(() => {
    if (ready && !allowed) {
      router.replace("/?login=1");
    }
  }, [ready, allowed, router]);

  if (!ready || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] text-sm font-semibold text-[#697080]">
        正在检查登录状态...
      </div>
    );
  }

  return <>{children}</>;
}

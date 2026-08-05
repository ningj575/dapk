"use client";

import { useAuthToken } from "@/components/auth-state";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ApiResponse<T> = { code: number; message: string; data: T };
type UnreadPayload = { unread_count?: number };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export function AnnouncementButton() {
  const token = useAuthToken();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/announcements/unread-count`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as ApiResponse<UnreadPayload>;
      if (response.ok && payload.code === 0) {
        setUnreadCount(Number(payload.data?.unread_count || 0));
      }
    } catch {
      // 公告红点不应影响工作台主流程。
    }
  }, [token]);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    const onFocus = () => void loadUnread();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadUnread, token]);

  return (
    <Link
      href="/announcements"
      aria-label="公告"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ded8cd] bg-white text-[#5f6674] shadow-[0_1px_2px_rgba(16,24,39,0.04)] transition hover:border-[#c9c0b2] hover:text-[#101827]"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
      )}
    </Link>
  );
}

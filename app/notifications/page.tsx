"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";

type NotificationItem = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [dashboardHref, setDashboardHref] = useState("/dashboard/client");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(
    async (selectedFilter: "all" | "unread") => {
      const response = await fetch(
        `/api/notifications?limit=100&filter=${selectedFilter}`,
        {
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load notifications");
      }

      setNotifications(data.notifications || []);
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setDashboardHref(
        profile?.role === "professional"
          ? "/dashboard/professional"
          : "/dashboard/client",
      );

      try {
        await loadNotifications("all");
      } catch (err: any) {
        setError(err.message || "Failed to load notifications");
      }
      setLoading(false);
    };

    init();
  }, [loadNotifications, router, supabase]);

  useEffect(() => {
    if (loading) return;
    loadNotifications(filter).catch((err: any) => {
      setError(err.message || "Failed to load notifications");
    });
  }, [filter, loadNotifications, loading]);

  const markAsRead = async (id: string) => {
    const current = notifications.find((item) => item.id === id);
    if (!current || current.is_read) return;

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );

    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? current : item)),
      );
    }
  };

  const markAllAsRead = async () => {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true })),
    );

    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });

    if (!response.ok) {
      setNotifications(previous);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading notifications...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Survey<span className="text-green-600">ConnectHub</span>
        </h1>
        <BackButton href={dashboardHref} label="Dashboard" />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-2 text-sm rounded-lg ${
                filter === "all"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-3 py-2 text-sm rounded-lg ${
                filter === "unread"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
            <div className="flex justify-center text-gray-400 mb-3">
              <Bell className="w-9 h-9" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              No notifications yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <Link
                key={item.id}
                href={item.link || "/notifications"}
                onClick={() => markAsRead(item.id)}
                className={`block rounded-2xl border p-4 transition-colors ${
                  item.is_read
                    ? "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                    : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {item.title || "Notification"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {item.message || "You have a new update."}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

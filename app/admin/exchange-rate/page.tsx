"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import AppBrand from "@/components/dashboard/AppBrand";
import DashboardHeaderActions from "@/components/dashboard/DashboardHeaderActions";
import { ArrowLeft } from "lucide-react";

type OverrideRow = {
  id: string;
  rate: number;
  created_at: string;
  set_by: string;
  full_name: string;
};

export default function ExchangeRateAdminPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [rateInput, setRateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [historyError, setHistoryError] = useState("");

  const getCurrentUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session.user;
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }, [supabase]);

  const fetchOverrides = useCallback(async () => {
    setHistoryError("");
    try {
      const res = await fetch("/api/admin/exchange-rate-override", {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data?.error || "Could not load override history");
        return;
      }
      setOverrides(Array.isArray(data?.overrides) ? data.overrides : []);
    } catch {
      setHistoryError("Could not load override history");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/");
          return;
        }

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("is_admin, full_name")
          .eq("id", user.id)
          .single();

        if (!profileRow?.is_admin) {
          router.push("/");
          return;
        }

        setProfile(profileRow);
        setUserId(user.id);
        setLoading(false);
        fetchOverrides();
      } catch (error) {
        console.error("Admin exchange-rate page init failed:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [getCurrentUser, router, supabase, fetchOverrides]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);

    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setSubmitError("Enter a finite number greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/exchange-rate-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error || "Could not save override");
        return;
      }
      setSubmitSuccess(true);
      setRateInput("");
      fetchOverrides();
    } catch {
      setSubmitError("Network error while saving override");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const rateFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <AppBrand />
        <DashboardHeaderActions
          theme={theme}
          toggleTheme={toggleTheme}
          fullName={profile?.full_name || ""}
          userId={userId}
          unreadNotifications={unreadNotifications}
          onUnreadNotificationsChange={setUnreadNotifications}
        />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to admin
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Exchange Rate Override
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Set a manual USD &rarr; NGN rate used as a last resort when all live
            providers fail. Live providers are always re-tried first on every
            payment past the cache window, so this override is automatically
            replaced the moment live data returns.
          </p>
        </div>

        {/* Set new override form */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Set new rate
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="rate"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                USD &rarr; NGN rate
              </label>
              <input
                id="rate"
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                disabled={submitting}
                placeholder="e.g. 1580.5"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !rateInput}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:hover:bg-green-600 text-white font-medium transition-colors flex items-center justify-center min-w-[120px]"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save override"
              )}
            </button>
          </form>
          {submitError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              Override saved successfully.
            </p>
          )}
        </div>

        {/* Override history */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent overrides
          </h3>

          {historyError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {historyError}
            </p>
          )}

          {!historyError && overrides.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No overrides set yet. A manual rate will only be used if all live
              exchange rate providers fail and no override exists.
            </p>
          )}

          {overrides.length > 0 && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {overrides.map((row) => (
                <li
                  key={row.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                >
                  <div className="text-gray-900 dark:text-white">
                    <span className="font-medium">
                      NGN {rateFormatter.format(row.rate)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      {" "}
                      / USD
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 sm:text-right">
                    <div>
                      Set by{" "}
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {row.full_name}
                      </span>
                    </div>
                    <div>{dateFormatter.format(new Date(row.created_at))}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

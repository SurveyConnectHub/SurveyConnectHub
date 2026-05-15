"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, MessageSquareOff, FileCheck } from "lucide-react";
import { CardSkeleton } from "@/components/ui/Skeleton";
import BackButton from "@/components/ui/BackButton";
import type { Contract, Job, Profile } from "@/types/database";

type ContractRow = Contract & {
  jobs: Pick<Job, "title" | "description"> | null;
  profiles: Pick<Profile, "full_name" | "email"> | null;
};

export default function ClientContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const getData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("contracts")
        .select(
          `*, jobs(title, description), profiles!contracts_professional_id_fkey(full_name, email)`,
        )
        .eq("client_id", user.id)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      setContracts(data || []);
      setLoading(false);
    };
    getData();
  }, [router]);

  const handleReleasePayment = async (contractId: string) => {
    setReleasing(contractId);
    setMessage("");

    try {
      const response = await fetch("/api/paystack/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to release payment");
        setReleasing(null);
        return;
      }

      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId
            ? { ...c, payment_released_at: new Date().toISOString() }
            : c,
        ),
      );
      setMessage("Payment released successfully! Messaging has been closed.");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setReleasing(null);
    }
  };

  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={`client-contracts-skeleton-${index}`} />
          ))}
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
        <BackButton href="/dashboard/client" label="Dashboard" />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Contracts
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl p-4 mb-6 text-sm font-medium ${
              message.includes("success")
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            }`}
          >
            {message}
          </div>
        )}

        {contracts.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileCheck className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No contracts yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Accept a proposal and pay to start a contract
            </p>
            <Link
              href="/dashboard/client/jobs"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              View My Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => {
              const isChatLocked = contract.payment_released_at !== null;
              const isPaid = contract.payment_released_at !== null;

              return (
                <div
                  key={contract.id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl p-6 border transition-all ${
                    isPaid
                      ? "border-gray-200 dark:border-gray-700 opacity-75"
                      : contract.status === "completed"
                        ? "border-yellow-300 dark:border-yellow-700"
                        : "border-green-300 dark:border-green-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {contract.jobs?.title}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            isPaid
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              : contract.status === "completed"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          }`}
                        >
                          {isPaid
                            ? "Paid"
                            : contract.status === "completed"
                              ? "Awaiting Approval"
                              : "In Progress"}
                        </span>
                      </div>

                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                        Professional: {contract.profiles?.full_name}
                      </p>

                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Started {formatDate(contract.start_date)}
                      </p>

                      {contract.status === "completed" && !isPaid && (
                        <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                          <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                            The professional has marked this job as complete.
                            Review the work and release payment if satisfied.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0 space-y-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${Number(contract.agreed_budget).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          agreed budget
                        </p>
                      </div>

                      <div className="space-y-2">
                        {isChatLocked ? (
                          <span className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm font-semibold px-4 py-2 rounded-xl cursor-not-allowed">
                            <MessageSquareOff className="w-4 h-4" />
                            Chat Closed
                          </span>
                        ) : (
                          <Link
                            href={`/messages/${contract.id}`}
                            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Open Chat
                          </Link>
                        )}

                        {contract.status === "completed" && !isPaid && (
                          <button
                            onClick={() => handleReleasePayment(contract.id)}
                            disabled={releasing === contract.id}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                          >
                            {releasing === contract.id
                              ? "Releasing..."
                              : "Release Payment"}
                          </button>
                        )}

                        {isPaid && (
                          <span className="block bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-semibold px-4 py-2 rounded-xl text-center">
                            Payment Released
                          </span>
                        )}

                        {contract.status === "active" && !isPaid && (
                          <span className="block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold px-4 py-2 rounded-xl text-center">
                            Work in Progress
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

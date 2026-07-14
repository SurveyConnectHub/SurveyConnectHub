"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { userLocale } from "@/lib/datetime";
import type { Job, JobApplication, Profile } from "@/types/database";
import BackButton from "@/components/ui/BackButton";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Inbox,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";

export default function JobApplicationsPage() {
  const router = useRouter();
  const { jobId } = useParams();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<
    (JobApplication & {
      profiles: Pick<Profile, "full_name" | "country" | "email"> | null;
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

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

      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("client_id", user.id)
        .single();

      if (!jobData) {
        router.push("/dashboard/client/jobs");
        return;
      }
      setJob(jobData);

      const { data: apps } = await supabase
        .from("job_applications")
        .select(
          `
          *,
          profiles!job_applications_professional_id_fkey (
            full_name,
            country,
            email
          )
        `,
        )
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      setApplications(apps || []);
      setLoading(false);
    };
    getData();
  }, [jobId, router]);

  const handleAccept = async (
    applicationId: string,
    professionalId: string,
  ) => {
    if (!job) {
      return;
    }
    const supabase = createClient();
    setAccepting(applicationId);

    try {
      const acceptedApp = applications.find((a) => a.id === applicationId);
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .insert({
          job_id: jobId,
          client_id: job.client_id,
          professional_id: professionalId,
          application_id: applicationId,
          agreed_budget: acceptedApp?.proposed_rate,
          escrow_amount: acceptedApp?.proposed_rate,
          status: "pending",
        })
        .select()
        .single();

      if (contractError || !contract) {
        console.error("Contract creation failed:", contractError);
        setAccepting(null);
        return;
      }

      router.push(`/payments/${contract.id}`);
    } catch (err) {
      console.error(err);
      setAccepting(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    const supabase = createClient();
    await supabase
      .from("job_applications")
      .update({ status: "rejected" })
      .eq("id", applicationId);

    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId ? { ...a, status: "rejected" } : a,
      ),
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(userLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDelivery = (value: string | null) => {
    if (!value) return "";
    return value
      .split("_")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Survey<span className="text-green-600">ConnectHub</span>
        </h1>
        <BackButton href="/dashboard/client/jobs" label="My Jobs" />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {job?.title}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {job?.description}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> ${job?.budget}{" "}
              {job?.budget_type}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {job?.location || "Remote"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {applications.length}{" "}
              application{applications.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Applications ({applications.length})
        </h3>

        {applications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800">
            <div className="flex justify-center mb-4">
              <Inbox className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No applications yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Check back later — professionals will apply soon
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl p-6 border transition-all ${
                  app.status === "accepted"
                    ? "border-green-400 dark:border-green-600"
                    : app.status === "rejected"
                      ? "border-gray-200 dark:border-gray-800 opacity-60"
                      : "border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <span className="text-green-700 dark:text-green-300 text-sm font-bold">
                          {app.profiles?.full_name
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("") || "??"}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {app.profiles?.full_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {app.profiles?.country}
                        </p>
                      </div>
                      {/* View Profile link */}
                      <Link
                        href={`/professionals/${app.professional_id}`}
                        className="ml-2 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium underline underline-offset-2"
                        target="_blank"
                      >
                        View Profile →
                      </Link>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 leading-relaxed">
                      {app.cover_letter}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Applied{" "}
                        {formatDate(app.created_at)}
                      </span>
                      {app.estimated_delivery && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" /> Estimated
                          delivery {formatDelivery(app.estimated_delivery)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${app.proposed_rate}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        proposed rate
                      </p>
                    </div>

                    {app.status === "pending" && (
                      <div className="space-y-2">
                        <button
                          onClick={() =>
                            handleAccept(app.id, app.professional_id)
                          }
                          disabled={accepting === app.id}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                        >
                          {accepting === app.id
                            ? "Creating contract..."
                            : "Accept & Pay"}
                        </button>
                        <button
                          onClick={() => handleReject(app.id)}
                          className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {app.status === "accepted" && (
                      <span className="block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold px-4 py-2 rounded-xl text-center">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Accepted
                        </span>
                      </span>
                    )}

                    {app.status === "rejected" && (
                      <span className="block bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-semibold px-4 py-2 rounded-xl text-center">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

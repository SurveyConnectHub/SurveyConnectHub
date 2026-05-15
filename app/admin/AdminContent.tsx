"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProfessionalProfile } from "@/types/database";
import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  FileCheck,
  FileText,
  IdCard,
  Info,
  Users,
} from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import BackButton from "@/components/ui/BackButton";

export type AdminStats = {
  totalUsers: number;
  totalClients: number;
  totalProfessionals: number;
  totalJobs: number;
  totalContracts: number;
  platformRevenue: number;
  pendingVerifications: number;
};

type PendingProfileInfo = Pick<Profile, "full_name" | "email" | "country">;

export type PendingProfessional = Pick<
  ProfessionalProfile,
  | "id"
  | "profession_type"
  | "license_number"
  | "years_experience"
  | "id_document_url"
  | "license_url"
  | "verification_status"
  | "created_at"
> & {
  profiles: PendingProfileInfo | null;
};

type AdminContentProps = {
  initialStats: AdminStats;
  initialPendingProfessionals: PendingProfessional[];
};

export default function AdminContent({
  initialStats,
  initialPendingProfessionals,
}: AdminContentProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [pendingProfessionals, setPendingProfessionals] = useState<
    PendingProfessional[]
  >(initialPendingProfessionals);
  const [actionLoading, setActionLoading] = useState<{
    id: string;
    type: "verified" | "rejected";
  } | null>(null);
  const [message, setMessage] = useState("");

  const getProfessionLabel = (type: string) => {
    const labels: Record<string, string> = {
      land_surveyor: "Land Surveyor",
      gis_analyst: "GIS Analyst",
      drone_pilot: "Drone/UAV Pilot",
      cartographer: "Cartographer",
      photogrammetrist: "Photogrammetrist",
      lidar_specialist: "LiDAR Specialist",
      remote_sensing_analyst: "Remote Sensing Analyst",
      urban_planner: "Urban Planner",
      spatial_data_scientist: "Spatial Data Scientist",
      hydrographic_surveyor: "Hydrographic Surveyor",
      mining_surveyor: "Mining Surveyor",
      construction_surveyor: "Construction Surveyor",
      environmental_analyst: "Environmental Analyst",
      bim_specialist: "BIM Specialist",
      other: "Other",
    };
    return labels[type] || type;
  };

  const handleViewDocument = async (pathOrUrl: string) => {
    try {
      const response = await fetch("/api/admin/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathOrUrl }),
      });

      if (!response.ok) {
        throw new Error(`Signed URL request failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.signedUrl) {
        window.open(data.signedUrl, "_blank");
        return;
      }

      throw new Error("Signed URL missing");
    } catch (error) {
      console.error("Failed to load document:", error);
      alert("Could not load document.");
    }
  };

  const handleVerify = async (
    professionalId: string,
    action: "verified" | "rejected",
    prof: PendingProfessional,
  ) => {
    setActionLoading({ id: professionalId, type: action });
    setMessage("");

    try {
      const { error } = await supabase
        .from("professional_profiles")
        .update({ verification_status: action })
        .eq("id", professionalId);

      if (error) {
        setMessage("Something went wrong.");
        return;
      }

      if (action === "verified" && prof.license_url) {
        let licensePath = prof.license_url;
        if (prof.license_url.includes("/storage/v1/object/")) {
          const parts = prof.license_url.split("/verification-documents/");
          licensePath = parts[1] || prof.license_url;
        }
        await supabase.storage
          .from("verification-documents")
          .remove([licensePath]);
      }

      setPendingProfessionals((prev) =>
        prev.filter((p) => p.id !== professionalId),
      );
      setStats((prev) => ({
        ...prev,
        pendingVerifications: Math.max(prev.pendingVerifications - 1, 0),
      }));
      setMessage(
        action === "verified"
          ? "Professional verified! License certificate deleted from storage."
          : "Professional rejected.",
      );
      setTimeout(() => setMessage(""), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="SurveyConnectHub"
            width={40}
            height={40}
            className="h-10 w-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Survey<span className="text-green-600">ConnectHub</span>
          </h1>
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-1 rounded-full">
            ADMIN
          </span>
        </div>
        <BackButton href="/dashboard/client" label="Dashboard" />
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Platform overview and verification management
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl p-4 mb-6 text-sm font-medium ${
              message.includes("verified") || message.includes("deleted")
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            }`}
          >
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Total Users
              </p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalUsers}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {stats.totalClients} clients · {stats.totalProfessionals}{" "}
              professionals
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-4 h-4 text-green-500" />
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Total Jobs
              </p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalJobs}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck className="w-4 h-4 text-purple-500" />
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Total Contracts
              </p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalContracts}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Platform Revenue
              </p>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${stats.platformRevenue.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Verifications
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {stats.pendingVerifications} professional
                {stats.pendingVerifications !== 1 ? "s" : ""} awaiting review
              </p>
            </div>
            {stats.pendingVerifications > 0 && (
              <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-bold px-3 py-1 rounded-full">
                {stats.pendingVerifications} pending
              </span>
            )}
          </div>

          {pendingProfessionals.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No pending verifications
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {pendingProfessionals.map((prof) => (
                <div key={prof.id} className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                          <span className="text-green-700 dark:text-green-300 text-sm font-bold">
                            {prof.profiles?.full_name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join("") || "??"}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {prof.profiles?.full_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {prof.profiles?.email} · {prof.profiles?.country}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Profession
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {getProfessionLabel(prof.profession_type)}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            License Number
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {prof.license_number || (
                              <span className="text-gray-400 italic">
                                Not provided
                              </span>
                            )}
                          </p>
                        </div>
                        {prof.years_experience > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Experience
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {prof.years_experience} year
                              {prof.years_experience !== 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 flex-wrap">
                        {prof.id_document_url ? (
                          <button
                            onClick={() =>
                              handleViewDocument(prof.id_document_url || "")
                            }
                            className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-blue-200 dark:border-blue-800"
                          >
                            <IdCard className="w-4 h-4" />
                            View ID Document
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600 italic">
                            No ID document uploaded
                          </span>
                        )}
                        {prof.license_url ? (
                          <button
                            onClick={() =>
                              handleViewDocument(prof.license_url || "")
                            }
                            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-purple-200 dark:border-purple-800"
                          >
                            <FileText className="w-4 h-4" />
                            View License
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600 italic">
                            No license uploaded
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 mt-3">
                        <Info className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-400 dark:text-gray-600">
                          Approving will delete the license certificate from
                          storage (license number is saved in DB)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <LoadingButton
                        onClick={() => handleVerify(prof.id, "verified", prof)}
                        isLoading={
                          actionLoading?.id === prof.id &&
                          actionLoading?.type === "verified"
                        }
                        loadingText="Updating..."
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
                      >
                        Approve
                      </LoadingButton>
                      <LoadingButton
                        onClick={() => handleVerify(prof.id, "rejected", prof)}
                        isLoading={
                          actionLoading?.id === prof.id &&
                          actionLoading?.type === "rejected"
                        }
                        loadingText="Updating..."
                        className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
                      >
                        Reject
                      </LoadingButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

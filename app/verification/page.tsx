"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProfessionLabel } from "@/lib/constants";
import {
  CheckCircle2,
  Hourglass,
  IdCard,
  ScrollText,
  XCircle,
} from "lucide-react";
import BackButton from "@/components/ui/BackButton";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];

export default function VerificationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profProfile, setProfProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [idFile, setIdFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [idFileError, setIdFileError] = useState("");
  const [licenseFileError, setLicenseFileError] = useState("");

  useEffect(() => {
    const getData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "professional") {
        router.push("/dashboard/client");
        return;
      }

      const { data: profProfile } = await supabase
        .from("professional_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUser(user);
      setProfile(profile);
      setProfProfile(profProfile);
      setLoading(false);
    };

    getData();
  }, [router, supabase]);

  const validateFile = (file: File): string => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (
      !ALLOWED_TYPES.includes(file.type) ||
      !ALLOWED_EXTENSIONS.includes(ext)
    ) {
      return "Only JPG, PNG, or PDF files are allowed.";
    }
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File is ${sizeMB}MB — maximum allowed size is 2MB. Please compress or resize your file.`;
    }
    return "";
  };

  const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setIdFileError("");
    if (!file) {
      setIdFile(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setIdFileError(err);
      setIdFile(null);
      e.target.value = ""; // reset input so they can reselect
      return;
    }
    setIdFile(file);
  };

  const handleLicenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLicenseFileError("");
    if (!file) {
      setLicenseFile(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setLicenseFileError(err);
      setLicenseFile(null);
      e.target.value = "";
      return;
    }
    setLicenseFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!idFile) {
      setError("Please upload your government-issued ID");
      return;
    }
    if (!licenseFile) {
      setError("Please upload your professional license or certificate");
      return;
    }
    if (!profProfile?.profession_type) {
      setError("Complete your professional onboarding details first.");
      return;
    }
    if (idFileError || licenseFileError) {
      setError("Please fix the file errors before submitting.");
      return;
    }

    setUploading(true);

    try {
      const idFileName = `${user.id}/id-${Date.now()}.${idFile.name.split(".").pop()}`;
      const { error: idError } = await supabase.storage
        .from("verification-documents")
        .upload(idFileName, idFile);
      if (idError) throw idError;

      const licenseFileName = `${user.id}/license-${Date.now()}.${licenseFile.name.split(".").pop()}`;
      const { error: licenseError } = await supabase.storage
        .from("verification-documents")
        .upload(licenseFileName, licenseFile);
      if (licenseError) throw licenseError;

      const { error: updateError } = await supabase
        .from("professional_profiles")
        .upsert({
          id: user.id,
          profession_type: profProfile.profession_type,
          license_number: profProfile.license_number || null,
          years_experience: profProfile.years_experience || 0,
          id_document_url: idFileName,
          license_url: licenseFileName,
          verification_status: "pending",
        });
      if (updateError) throw updateError;

      try {
        await fetch("/api/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professionalName: profile?.full_name,
            professionType: getProfessionLabel(profProfile.profession_type),
            userId: user.id,
          }),
        });
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }

      setSuccess(
        "Documents uploaded successfully! Our team will review your verification within 24-48 hours.",
      );
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (profProfile?.verification_status === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 text-center border border-transparent dark:border-gray-800">
          <div className="flex justify-center mb-4">
            <Hourglass className="w-12 h-12 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Verification Pending
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Your documents have been submitted and are being reviewed by our
            team. This usually takes 24-48 hours.
          </p>
          <Link
            href="/dashboard/professional"
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (profProfile?.verification_status === "verified") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 text-center border border-transparent dark:border-gray-800">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You are Verified!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Your professional credentials have been verified. You can now apply
            to jobs on SurveyConnectHub.
          </p>
          <Link
            href="/dashboard/professional"
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Browse Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 transition-colors duration-300">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Survey<span className="text-green-600">ConnectHub</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Professional Verification
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-800">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-8">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
              Why do we verify professionals?
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Verification builds trust with clients and ensures only qualified
              professionals work on critical geospatial projects. Verified
              professionals get more job opportunities.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Professional Details (from onboarding)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Profession Type:
                  </span>{" "}
                  {profProfile?.profession_type
                    ? getProfessionLabel(profProfile.profession_type)
                    : "Not set"}
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Years Experience:
                  </span>{" "}
                  {typeof profProfile?.years_experience === "number"
                    ? profProfile.years_experience
                    : "Not set"}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    License Number:
                  </span>{" "}
                  {profProfile?.license_number || "Not set"}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                Need to update these details? Go back to onboarding.
              </p>
            </div>

            {/* Government ID Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Government-Issued ID <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Passport, Driver&apos;s License, or National ID Card (JPG, PNG
                or PDF, max 2MB)
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  idFileError
                    ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                    : idFile
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleIdFileChange}
                  className="hidden dark:text-white dark:placeholder-gray-400"
                  id="id-upload"
                />
                <label htmlFor="id-upload" className="cursor-pointer">
                  {idFileError ? (
                    <div>
                      <div className="flex justify-center mb-1">
                        <XCircle className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-red-600 dark:text-red-400 font-medium text-sm">
                        {idFileError}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                        Click to choose a different file
                      </p>
                    </div>
                  ) : idFile ? (
                    <div>
                      <div className="flex justify-center mb-1">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-green-700 dark:text-green-400 font-medium">
                        {idFile.name}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                        {(idFile.size / (1024 * 1024)).toFixed(2)}MB · Click to
                        change
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-center mb-2">
                        <IdCard className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Click to upload ID
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        JPG, PNG or PDF · Max 2MB
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* License Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Professional License / Certificate{" "}
                <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Your surveying license, GIS certification, or relevant
                professional certificate (JPG, PNG or PDF, max 2MB)
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  licenseFileError
                    ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                    : licenseFile
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleLicenseFileChange}
                  className="hidden dark:text-white dark:placeholder-gray-400"
                  id="license-upload"
                />
                <label htmlFor="license-upload" className="cursor-pointer">
                  {licenseFileError ? (
                    <div>
                      <div className="flex justify-center mb-1">
                        <XCircle className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-red-600 dark:text-red-400 font-medium text-sm">
                        {licenseFileError}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                        Click to choose a different file
                      </p>
                    </div>
                  ) : licenseFile ? (
                    <div>
                      <div className="flex justify-center mb-1">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-green-700 dark:text-green-400 font-medium">
                        {licenseFile.name}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                        {(licenseFile.size / (1024 * 1024)).toFixed(2)}MB ·
                        Click to change
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-center mb-2">
                        <ScrollText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Click to upload license
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        JPG, PNG or PDF · Max 2MB
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !!idFileError || !!licenseFileError}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {uploading ? "Uploading documents..." : "Submit for Verification"}
            </button>
          </form>

          <div className="flex justify-center mt-6">
            <BackButton
              href="/dashboard/professional"
              label="Back to Dashboard"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

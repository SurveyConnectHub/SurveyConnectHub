"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ProfileSkeleton } from "@/components/ui/Skeleton";

export default function ProfessionalProfilePage() {
  const router = useRouter();
  const { id: rawId } = useParams();
  const id = rawId as string;
  const supabase = useMemo(() => createClient(), []);

  const [prof, setProf] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [viewerRole, setViewerRole] = useState<string>("");
  const [viewerId, setViewerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [eligibleContracts, setEligibleContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const getProfessionLabel = (type: string) => {
    const labels: any = {
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

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(
        1,
      )
    : null;

  useEffect(() => {
    if (!id || typeof id !== "string") {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const getData = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push("/login");
          return;
        }

        setViewerId(user.id);

        const { data: viewerProfile, error: viewerProfileError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (viewerProfileError) {
          console.error("Failed to load viewer profile", viewerProfileError);
        }

        setViewerRole(viewerProfile?.role || "");

        const [professionalResult, profileResult] = await Promise.all([
          supabase
            .from("professional_profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, country, bio")
            .eq("id", id)
            .maybeSingle(),
        ]);

        if (profileResult.error) {
          console.error("Failed to load public profile", profileResult.error);
          setNotFound(true);
          return;
        }

        if (!profileResult.data) {
          setNotFound(true);
          return;
        }

        if (professionalResult.error) {
          console.error(
            "Failed to load professional details",
            professionalResult.error,
          );
        }

        setProf(professionalResult.data);
        setProfile(profileResult.data);

        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select("*, profiles!reviews_reviewer_id_fkey(full_name)")
          .eq("reviewee_id", id)
          .order("created_at", { ascending: false });

        if (reviewsError) {
          console.error("Failed to load reviews", reviewsError);
        }

        setReviews(reviewsData || []);

        if (viewerProfile?.role === "client") {
          const { data: contractsData, error: contractsError } = await supabase
            .from("contracts")
            .select("id, jobs(title)")
            .eq("client_id", user.id)
            .eq("professional_id", id)
            .not("payment_released_at", "is", null);

          if (contractsError) {
            console.error("Failed to load eligible contracts", contractsError);
          }

          const { data: existingReviews, error: existingReviewsError } =
            await supabase
              .from("reviews")
              .select("contract_id")
              .eq("reviewer_id", user.id)
              .eq("reviewee_id", id);

          if (existingReviewsError) {
            console.error(
              "Failed to load existing reviews",
              existingReviewsError,
            );
          }

          const reviewedContractIds = (existingReviews || []).map(
            (r: any) => r.contract_id,
          );
          const eligible = (contractsData || []).filter(
            (c: any) => !reviewedContractIds.includes(c.id),
          );

          setEligibleContracts(eligible);
          if (eligible.length > 0) setSelectedContract(eligible[0].id);
        }
      } catch (err) {
        console.error("Unexpected error loading professional profile", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    getData();
  }, [id, router, supabase]);

  const handleSubmitReview = async () => {
    if (!rating || !selectedContract) return;
    setSubmitting(true);
    setReviewError(null);

    const { error } = await supabase.from("reviews").insert({
      contract_id: selectedContract,
      reviewer_id: viewerId,
      reviewee_id: id,
      rating,
      comment: comment.trim() || null,
    });

    if (error) {
      setReviewError(error.message || "Failed to submit review");
      setTimeout(() => setReviewError(null), 3000);
      setSubmitting(false);
      return;
    }

    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("*, profiles!reviews_reviewer_id_fkey(full_name)")
      .eq("reviewee_id", id)
      .order("created_at", { ascending: false });

    setReviews(reviewsData || []);
    setEligibleContracts((prev) =>
      prev.filter((c) => c.id !== selectedContract),
    );
    setRating(0);
    setComment("");
    setReviewSuccess(true);
    setTimeout(() => setReviewSuccess(false), 3000);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Professional not found
          </p>
          <Link
            href="/professionals"
            className="text-green-600 hover:underline"
          >
            Back to Professionals
          </Link>
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
        <Link
          href="/professionals"
          className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          Back to Professionals
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
              <span className="text-green-700 dark:text-green-300 text-2xl font-bold">
                {getInitials(profile?.full_name || "")}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile?.full_name}
                </h2>
                {prof?.verification_status === "verified" ? (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-3 py-1 rounded-full">
                    Verified
                  </span>
                ) : (
                  <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-3 py-1 rounded-full">
                    Unverified
                  </span>
                )}
              </div>
              {prof?.profession_type && (
                <p className="text-green-600 dark:text-green-400 font-medium mb-1">
                  {getProfessionLabel(prof?.profession_type)}
                </p>
              )}
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                {profile?.country || "Location not specified"}
              </p>
              {avgRating && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-lg ${Number(avgRating) >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                      >
                        &#9733;
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {avgRating}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Overview */}
        {prof && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Portfolio Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prof?.years_experience > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Experience
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {prof.years_experience} year
                    {prof.years_experience !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
              {prof?.license_number && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    License Number
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {prof.license_number}
                  </p>
                </div>
              )}
              {prof?.profession_type && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Profession
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {getProfessionLabel(prof.profession_type)}
                  </p>
                </div>
              )}
              {prof?.secondary_profession && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Secondary Profession
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {getProfessionLabel(prof.secondary_profession)}
                  </p>
                </div>
              )}
            </div>

            {profile?.bio && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  About
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
        )}

        {!prof && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              This professional has not completed their profile yet.
            </p>
          </div>
        )}

        {/* Leave a Review */}
        {viewerRole === "client" && eligibleContracts.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Leave a Review
            </h3>

            {eligibleContracts.length > 1 && (
              <div className="mb-4">
                <label
                  htmlFor="review-contract-select"
                  className="text-sm text-gray-600 dark:text-gray-400 mb-1 block"
                >
                  Select Contract
                </label>
                <select
                  id="review-contract-select"
                  value={selectedContract}
                  onChange={(e) => setSelectedContract(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 dark:placeholder-gray-400"
                >
                  {eligibleContracts.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.jobs?.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-3xl transition-colors ${rating >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-300"}`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                Review (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience working with this professional..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
              />
            </div>

            {reviewSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4">
                <p className="text-green-700 dark:text-green-400 text-sm font-medium">
                  Review submitted successfully!
                </p>
              </div>
            )}

            {reviewError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                  {reviewError}
                </p>
              </div>
            )}

            <button
              onClick={handleSubmitReview}
              disabled={!rating || submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Reviews {reviews.length > 0 && `(${reviews.length})`}
          </h3>
          {reviews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No reviews yet.
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-4 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {review.profiles?.full_name || "Anonymous"}
                    </p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${review.rating >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                        >
                          &#9733;
                        </span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      {review.comment}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(review.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hire Section */}
        {viewerRole === "client" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Hire this Professional
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Post a job and this professional can apply, or browse your
              existing jobs to invite them.
            </p>
            <Link
              href="/jobs/post"
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Post a Job
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

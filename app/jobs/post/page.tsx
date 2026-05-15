"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";

export default function PostJobPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [briefFile, setBriefFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    profession_type: "",
    job_type: "",
    location: "",
    estimated_duration: "",
    budget_model: "fixed" as "fixed" | "negotiable",
    budget_fixed: "",
    budget_min: "",
    budget_max: "",
    budget_type: "fixed" as "fixed" | "hourly",
    required_verification: true,
  });

  useEffect(() => {
    const checkUser = async () => {
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

      if (profile?.role !== "client") {
        router.push("/dashboard/professional");
        return;
      }

      setUser(user);
      setPageLoading(false);
    };

    checkUser();
  }, [router, supabase]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const type = (e.target as HTMLInputElement).type;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title) {
      setError("Job title is required");
      return;
    }
    if (!formData.description) {
      setError("Job description is required");
      return;
    }
    if (!formData.profession_type) {
      setError("Please select a profession type");
      return;
    }
    if (!formData.job_type) {
      setError("Please select a job type");
      return;
    }
    if (formData.job_type === "on_site" && !formData.location.trim()) {
      setError("Location is required for on-site roles");
      return;
    }
    if (formData.budget_model === "fixed") {
      if (!formData.budget_fixed) {
        setError("Budget amount is required");
        return;
      }
      if (parseFloat(formData.budget_fixed) < 1) {
        setError("Budget must be greater than 0");
        return;
      }
      if (parseFloat(formData.budget_fixed) > 30000) {
        setError(
          "Budget cannot exceed $30,000. For larger contracts, contact support@SurveyConnectHub.com",
        );
        return;
      }
    } else {
      if (formData.budget_min && formData.budget_max) {
        if (
          parseFloat(formData.budget_min) >= parseFloat(formData.budget_max)
        ) {
          setError("Maximum budget must be greater than minimum");
          return;
        }
      }
    }

    setLoading(true);

    try {
      let briefAttachmentUrl: string | null = null;
      if (briefFile) {
        const cleanName = briefFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const briefPath = `${user.id}/job-brief-${Date.now()}-${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("job-briefs")
          .upload(briefPath, briefFile);

        if (uploadError) {
          throw uploadError;
        }
        briefAttachmentUrl = briefPath;
      }

      const { error: jobError } = await supabase.from("jobs").insert({
        client_id: user.id,
        title: formData.title,
        description: formData.description,
        profession_type: formData.profession_type,
        job_type: formData.job_type,
        location: formData.job_type === "on_site" ? formData.location : null,
        required_skills: requiredSkills,
        estimated_duration: formData.estimated_duration || null,
        brief_attachment_url: briefAttachmentUrl,
        budget:
          formData.budget_model === "fixed"
            ? parseFloat(formData.budget_fixed)
            : parseFloat(formData.budget_max || formData.budget_min || "0"),
        budget_min:
          formData.budget_model === "negotiable"
            ? formData.budget_min
              ? parseFloat(formData.budget_min)
              : null
            : null,
        budget_max:
          formData.budget_model === "negotiable"
            ? formData.budget_max
              ? parseFloat(formData.budget_max)
              : null
            : null,
        budget_model: formData.budget_model,
        budget_type: formData.budget_type,
        required_verification: formData.required_verification,
        status: "open",
      });

      if (jobError) throw jobError;

      router.push("/dashboard/client/jobs");
    } catch (err: any) {
      setError(err.message || "Failed to post job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = skillInput.trim();
    if (!value) return;
    if (requiredSkills.includes(value)) {
      setSkillInput("");
      return;
    }
    setRequiredSkills((prev) => [...prev, value]);
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setRequiredSkills((prev) => prev.filter((item) => item !== skill));
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
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
            Post a New Job
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-800">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Land Survey for 50 Hectare Farm in Ogun State"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Describe the project in detail. Include scope, deliverables, timeline expectations, and any special requirements..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profession Needed <span className="text-red-500">*</span>
              </label>
              <select
                name="profession_type"
                value={formData.profession_type}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
              >
                <option value="">Select profession type</option>
                <option value="land_surveyor">Land Surveyor</option>
                <option value="gis_analyst">GIS Analyst</option>
                <option value="drone_pilot">Drone/UAV Pilot</option>
                <option value="cartographer">Cartographer</option>
                <option value="photogrammetrist">Photogrammetrist</option>
                <option value="lidar_specialist">LiDAR Specialist</option>
                <option value="remote_sensing_analyst">
                  Remote Sensing Analyst
                </option>
                <option value="urban_planner">Urban Planner</option>
                <option value="spatial_data_scientist">
                  Spatial Data Scientist
                </option>
                <option value="hydrographic_surveyor">
                  Hydrographic Surveyor
                </option>
                <option value="mining_surveyor">Mining Surveyor</option>
                <option value="construction_surveyor">
                  Construction Surveyor
                </option>
                <option value="environmental_analyst">
                  Environmental Analyst
                </option>
                <option value="bim_specialist">BIM Specialist</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Type <span className="text-red-500">*</span>
              </label>
              <select
                name="job_type"
                value={formData.job_type}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
              >
                <option value="">Select job type</option>
                <option value="remote">Remote</option>
                <option value="on_site">On-site</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            {formData.job_type === "on_site" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Enter job location"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            )}

            {/* Budget Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Budget Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, budget_model: "fixed" }))
                  }
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.budget_model === "fixed"
                      ? "border-green-600 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    Fixed Price
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    You set the exact price. No negotiation.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      budget_model: "negotiable",
                    }))
                  }
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.budget_model === "negotiable"
                      ? "border-green-600 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    Negotiable
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Set a range. Professionals propose their rate.
                  </p>
                </button>
              </div>
            </div>

            {/* Fixed Price Fields */}
            {formData.budget_model === "fixed" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fixed Amount (USD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      name="budget_fixed"
                      value={formData.budget_fixed}
                      onChange={handleChange}
                      placeholder="e.g. 500"
                      min="1"
                      max="30000"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Maximum $30,000.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rate Type
                  </label>
                  <select
                    name="budget_type"
                    value={formData.budget_type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  >
                    <option value="fixed">One-time</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>
              </div>
            )}

            {/* Negotiable Budget Fields */}
            {formData.budget_model === "negotiable" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Budget (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      name="budget_min"
                      value={formData.budget_min}
                      onChange={handleChange}
                      placeholder="e.g. 300"
                      min="1"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Maximum Budget (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      name="budget_max"
                      value={formData.budget_max}
                      onChange={handleChange}
                      placeholder="e.g. 600"
                      min="1"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Professionals will propose their rate. You negotiate and
                    agree before funding escrow.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Required Skills
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-1 text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Add multiple skills by pressing Enter after each one.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estimated Duration
              </label>
              <select
                name="estimated_duration"
                value={formData.estimated_duration}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 dark:placeholder-gray-400"
              >
                <option value="">Select duration</option>
                <option value="1_day">1 Day</option>
                <option value="3_days">3 Days</option>
                <option value="1_week">1 Week</option>
                <option value="2_weeks">2 Weeks</option>
                <option value="1_month">1 Month</option>
                <option value="3_months">3 Months</option>
                <option value="6_months">6 Months</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Brief Attachment
              </label>
              <input
                type="file"
                onChange={(e) => setBriefFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Upload a document or file with additional job details.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="required_verification"
                  checked={formData.required_verification}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-600 rounded dark:text-white dark:placeholder-gray-400"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Require verified professionals only (recommended)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Posting job..." : "Post Job"}
            </button>
          </form>

          <div className="flex justify-center mt-6">
            <BackButton href="/dashboard/client" label="Back to Dashboard" />
          </div>
        </div>
      </div>
    </div>
  );
}

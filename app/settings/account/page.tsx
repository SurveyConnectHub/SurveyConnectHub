"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useLoadingState } from "@/hooks/useLoadingState";
import { LoadingButton } from "@/components/ui/LoadingButton";
import BackButton from "@/components/ui/BackButton";

type Bank = {
  code: string;
  name: string;
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { isLoading: isSavingProfile, withLoading: withProfileLoading } =
    useLoadingState();
  const {
    isLoading: isSavingPreferences,
    withLoading: withPreferencesLoading,
  } = useLoadingState();
  const { isLoading: isSavingPassword, withLoading: withPasswordLoading } =
    useLoadingState();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isProfessional, setIsProfessional] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    country: "",
    city: "",
    bio: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });

  const [preferences, setPreferences] = useState({
    notification_email: true,
    notification_messages: true,
    notification_marketing: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "role, full_name, phone, country, city, bio, bank_name, bank_account_number, bank_account_name, notification_email, notification_messages, notification_marketing",
        )
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        setError("Failed to load settings");
        setLoading(false);
        return;
      }

      setIsProfessional(profileData.role === "professional");
      setProfile({
        full_name: profileData.full_name || "",
        phone: profileData.phone || "",
        country: profileData.country || "",
        city: profileData.city || "",
        bio: profileData.bio || "",
        bank_name: profileData.bank_name || "",
        bank_account_number: profileData.bank_account_number || "",
        bank_account_name: profileData.bank_account_name || "",
      });

      setPreferences({
        notification_email: profileData.notification_email ?? true,
        notification_messages: profileData.notification_messages ?? true,
        notification_marketing: profileData.notification_marketing ?? false,
      });

      if (profileData.role === "professional") {
        const bankResponse = await fetch("/api/banks", { cache: "no-store" });
        const bankData = await bankResponse.json().catch(() => ({}));
        if (Array.isArray(bankData?.banks)) {
          setBanks(bankData.banks);
        }
      }

      setLoading(false);
    };

    init();
  }, [router, supabase]);

  const saveProfile = () => {
    setError("");
    setMessage("");

    if (!profile.full_name.trim()) {
      setError("Full name is required");
      return;
    }

    if (
      isProfessional &&
      profile.bank_account_number &&
      !/^\d{10}$/.test(profile.bank_account_number)
    ) {
      setError("Bank account number must be exactly 10 digits");
      return;
    }

    withProfileLoading(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Unauthorized");
        return;
      }

      const payload: any = {
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
        country: profile.country.trim(),
        city: profile.city.trim(),
        bio: profile.bio.trim(),
      };

      if (isProfessional) {
        payload.bank_name = profile.bank_name || null;
        payload.bank_account_number = profile.bank_account_number || null;
        payload.bank_account_name = profile.bank_account_name || null;
        payload.paystack_recipient_code = null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (updateError) {
        setError("Failed to update profile settings");
      } else {
        setMessage("Profile settings updated");
      }
    });
  };

  const savePreferences = () => {
    setError("");
    setMessage("");

    withPreferencesLoading(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Unauthorized");
        return;
      }

      const { error: prefError } = await supabase
        .from("profiles")
        .update(preferences)
        .eq("id", user.id);

      if (prefError) {
        setError("Failed to save notification preferences");
      } else {
        setMessage("Notification preferences updated");
      }
    });
  };

  const updatePassword = () => {
    setError("");
    setMessage("");

    if (passwordForm.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    withPasswordLoading(async () => {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (passwordError) {
        setError(passwordError.message || "Failed to update password");
      } else {
        setPasswordForm({ newPassword: "", confirmPassword: "" });
        setMessage("Password updated successfully");
      }
    });
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm("Sign out of your account?");
    if (!confirmed) return;

    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading settings...
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
        <BackButton
          href={
            isProfessional ? "/dashboard/professional" : "/dashboard/client"
          }
          label="Dashboard"
        />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your account details and preferences
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile
          </h3>
          <div>
            <label
              htmlFor="settings-full-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="settings-full-name"
              type="text"
              placeholder="Full name"
              value={profile.full_name}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, full_name: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-phone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Phone
              </label>
              <input
                id="settings-phone"
                type="text"
                placeholder="Phone"
                value={profile.phone}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div>
              <label
                htmlFor="settings-country"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Country
              </label>
              <input
                id="settings-country"
                type="text"
                placeholder="Country"
                value={profile.country}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, country: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="settings-city"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              City
            </label>
            <input
              id="settings-city"
              type="text"
              placeholder="City"
              value={profile.city}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, city: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label
              htmlFor="settings-bio"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Bio
            </label>
            <textarea
              id="settings-bio"
              rows={3}
              placeholder="Bio"
              value={profile.bio}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, bio: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 resize-none dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {isProfessional && (
            <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="font-medium text-gray-900 dark:text-white">
                Payout Details
              </p>
              <label
                htmlFor="settings-bank"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Bank
              </label>
              <select
                id="settings-bank"
                value={profile.bank_name}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, bank_name: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              >
                <option value="">Select bank</option>
                {banks.map((bank) => (
                  <option key={`${bank.code}-${bank.name}`} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              <div>
                <label
                  htmlFor="settings-bank-account-number"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Bank account number
                </label>
                <input
                  id="settings-bank-account-number"
                  type="text"
                  placeholder="Bank account number"
                  maxLength={10}
                  value={profile.bank_account_number}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      bank_account_number: e.target.value.replace(
                        /[^0-9]/g,
                        "",
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-bank-account-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Bank account name
                </label>
                <input
                  id="settings-bank-account-name"
                  type="text"
                  placeholder="Bank account name"
                  value={profile.bank_account_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      bank_account_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
          )}

          <LoadingButton
            type="button"
            onClick={saveProfile}
            isLoading={isSavingProfile}
            loadingText="Saving..."
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
          >
            Save Profile
          </LoadingButton>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Preferences
          </h3>
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={preferences.notification_email}
              onChange={(e) =>
                setPreferences((prev) => ({
                  ...prev,
                  notification_email: e.target.checked,
                }))
              }
              className="dark:text-white dark:placeholder-gray-400"
            />
            Email notifications
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={preferences.notification_messages}
              onChange={(e) =>
                setPreferences((prev) => ({
                  ...prev,
                  notification_messages: e.target.checked,
                }))
              }
              className="dark:text-white dark:placeholder-gray-400"
            />
            Message notifications
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={preferences.notification_marketing}
              onChange={(e) =>
                setPreferences((prev) => ({
                  ...prev,
                  notification_marketing: e.target.checked,
                }))
              }
              className="dark:text-white dark:placeholder-gray-400"
            />
            Product and marketing updates
          </label>
          <LoadingButton
            type="button"
            onClick={savePreferences}
            isLoading={isSavingPreferences}
            loadingText="Saving..."
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
          >
            Save Preferences
          </LoadingButton>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Security
          </h3>
          <div>
            <label
              htmlFor="settings-new-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="settings-new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={
                  showNewPassword ? "Hide new password" : "Show new password"
                }
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="settings-confirm-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="settings-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 pr-11 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <LoadingButton
            type="button"
            onClick={updatePassword}
            isLoading={isSavingPassword}
            loadingText="Updating..."
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
          >
            Update Password
          </LoadingButton>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Legal
          </h3>
          <Link
            href="/terms"
            className="block text-sm text-green-600 hover:text-green-700"
          >
            Terms and Conditions
          </Link>
          <Link
            href="/privacy"
            className="block text-sm text-green-600 hover:text-green-700"
          >
            Privacy Policy
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sign Out
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You will need to sign in again to access your account.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="px-5 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold disabled:opacity-50"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

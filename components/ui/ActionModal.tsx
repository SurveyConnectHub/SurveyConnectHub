"use client";

import { useEffect, useId } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ModalVariant = "info" | "danger" | "success";

type ActionModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
  variant?: ModalVariant;
  isProcessing?: boolean;
  showCancel?: boolean;
};

const variantStyles: Record<ModalVariant, { iconBg: string; iconText: string; bar: string; primary: string; ring: string }> = {
  info: {
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconText: "text-emerald-600 dark:text-emerald-300",
    bar: "from-emerald-500 via-teal-400 to-lime-400",
    primary: "bg-emerald-600 hover:bg-emerald-700",
    ring: "ring-emerald-200/70 dark:ring-emerald-900/50",
  },
  danger: {
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconText: "text-rose-600 dark:text-rose-300",
    bar: "from-rose-500 via-orange-400 to-amber-400",
    primary: "bg-rose-600 hover:bg-rose-700",
    ring: "ring-rose-200/70 dark:ring-rose-900/50",
  },
  success: {
    iconBg: "bg-sky-100 dark:bg-sky-900/40",
    iconText: "text-sky-600 dark:text-sky-300",
    bar: "from-sky-500 via-cyan-400 to-emerald-400",
    primary: "bg-sky-600 hover:bg-sky-700",
    ring: "ring-sky-200/70 dark:ring-sky-900/50",
  },
};

export default function ActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  variant = "info",
  isProcessing = false,
  showCancel,
}: ActionModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const styles = variantStyles[variant];
  const icon =
    variant === "danger" ? (
      <AlertTriangle className={`w-5 h-5 ${styles.iconText}`} />
    ) : variant === "success" ? (
      <CheckCircle2 className={`w-5 h-5 ${styles.iconText}`} />
    ) : (
      <Info className={`w-5 h-5 ${styles.iconText}`} />
    );
  const allowCancel = showCancel ?? Boolean(onConfirm);
  const confirmText =
    confirmLabel ?? (onConfirm ? "Continue" : "Got it");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-[modal-fade_160ms_ease-out]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ${styles.ring} animate-[modal-pop_180ms_ease-out]`}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${styles.bar}`} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${styles.iconBg}`}>{icon}</div>
              <div>
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-gray-500 dark:text-gray-400"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            {allowCancel && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={isProcessing}
              >
                {cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm ?? onClose}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-70 ${styles.primary}`}
              disabled={isProcessing}
            >
              {isProcessing ? "Please wait..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

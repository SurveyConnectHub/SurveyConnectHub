"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import type { Notification } from "@/types/database";

type NotificationItem = Pick<
	Notification,
	"id" | "title" | "message" | "type" | "link" | "is_read" | "created_at"
>;

type NotificationBellDropdownProps = {
	unreadCount: number;
	onUnreadCountChange?: (count: number) => void;
};

const STORAGE_KEY = "sch_notifications";

type CachedNotifications = {
	notifications: NotificationItem[];
	fetchedAt: number;
	unreadCount: number;
};

const readCache = (): CachedNotifications | null => {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<CachedNotifications>;
		const notifications = Array.isArray(parsed.notifications)
			? parsed.notifications
			: [];
		const unreadCount =
			typeof parsed.unreadCount === "number"
				? parsed.unreadCount
				: notifications.filter((item) => !item.is_read).length;
		const fetchedAt =
			typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0;
		return { notifications, unreadCount, fetchedAt };
	} catch {
		try {
			sessionStorage.removeItem(STORAGE_KEY);
		} catch {
			// Ignore cleanup failures.
		}
		return null;
	}
};

const writeCache = (notifications: NotificationItem[], unreadCount: number) => {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				notifications,
				fetchedAt: Date.now(),
				unreadCount,
			}),
		);
	} catch {
		// Ignore write failures (e.g., storage full).
	}
};

export default function NotificationBellDropdown({
	unreadCount,
	onUnreadCountChange,
}: NotificationBellDropdownProps) {
	const [open, setOpen] = useState(false);
	const [isChecking, setIsChecking] = useState(false);
	const [markingAll, setMarkingAll] = useState(false);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const rootRef = useRef<HTMLDivElement>(null);
	const notificationsRef = useRef<NotificationItem[]>([]);
	const checkingRef = useRef(false);

	useEffect(() => {
		notificationsRef.current = notifications;
	}, [notifications]);

	const updateNotifications = useCallback(
		(updater: (items: NotificationItem[]) => NotificationItem[]) => {
			setNotifications((prev) => {
				const next = updater(prev);
				const nextUnreadCount = next.filter((item) => !item.is_read).length;
				onUnreadCountChange?.(nextUnreadCount);
				writeCache(next, nextUnreadCount);
				return next;
			});
		},
		[onUnreadCountChange],
	);

	const mergeNotifications = useCallback(async () => {
		if (checkingRef.current) return;
		checkingRef.current = true;
		setIsChecking(true);
		try {
			const response = await fetch("/api/notifications?limit=8", {
				cache: "no-store",
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) return;

			const serverItems: NotificationItem[] = Array.isArray(data.notifications)
				? data.notifications
				: [];
			const cachedItems = notificationsRef.current;
			const cachedIds = new Set(cachedItems.map((item) => item.id));
			const newItems = serverItems.filter((item) => !cachedIds.has(item.id));

			if (newItems.length === 0) return;

			const merged = [...newItems, ...cachedItems];
			const mergedUnreadCount = merged.filter((item) => !item.is_read).length;
			setNotifications(merged);
			onUnreadCountChange?.(mergedUnreadCount);
			writeCache(merged, mergedUnreadCount);
		} finally {
			checkingRef.current = false;
			setIsChecking(false);
		}
	}, [onUnreadCountChange]);

	useEffect(() => {
		const cached = readCache();
		if (cached) {
			setNotifications(cached.notifications);
			onUnreadCountChange?.(cached.unreadCount);
		}
		mergeNotifications().catch(() => {});
	}, [mergeNotifications, onUnreadCountChange]);

	useEffect(() => {
		if (open) {
			mergeNotifications().catch(() => {});
		}
	}, [open, mergeNotifications]);

	useEffect(() => {
		const onDocClick = (event: MouseEvent) => {
			if (!rootRef.current) return;
			if (!rootRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		const onEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onEscape);
		};
	}, []);

	const markOneAsRead = async (id: string) => {
		const existing = notificationsRef.current.find((item) => item.id === id);
		if (!existing || existing.is_read) return;

		updateNotifications((prev) =>
			prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
		);

		const response = await fetch("/api/notifications", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id }),
		});

		if (!response.ok) {
			updateNotifications((prev) =>
				prev.map((item) => (item.id === id ? existing : item)),
			);
			return;
		}

		// Already updated via setNotifications above.
	};

	const markAllAsRead = async () => {
		setMarkingAll(true);
		const previous = notificationsRef.current;
		updateNotifications((prev) =>
			prev.map((item) => ({ ...item, is_read: true })),
		);

		const response = await fetch("/api/notifications", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ markAll: true }),
		});

		if (!response.ok) {
			updateNotifications(() => previous);
			setMarkingAll(false);
			return;
		}
		setMarkingAll(false);
	};

	const formatDate = (value: string) =>
		new Date(value).toLocaleString(
			typeof navigator !== "undefined" ? navigator.language : undefined,
			{
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			},
		);

	return (
		<div
			ref={rootRef}
			className="relative"
		>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="relative w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
				title="Notifications"
				aria-label="Notifications"
			>
				<Bell className="w-4 h-4" />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 mt-2 w-[320px] max-h-[420px] overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
						<p className="text-sm font-semibold text-gray-900 dark:text-white">
							Notifications
						</p>
						<div className="flex items-center gap-2">
							{isChecking && (
								<span className="text-[11px] text-gray-400 dark:text-gray-500">
									Checking for new...
								</span>
							)}
							<button
								type="button"
								onClick={markAllAsRead}
								disabled={markingAll || unreadCount === 0}
								className="text-xs text-green-600 disabled:text-gray-400 inline-flex items-center gap-1"
							>
								<CheckCheck className="w-3.5 h-3.5" />
								Mark all
							</button>
						</div>
					</div>

					<div className="max-h-[320px] overflow-y-auto">
						{notifications.length === 0 ? (
							<div className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
								No notifications yet.
							</div>
						) : (
							notifications.map((item) => (
								<Link
									key={item.id}
									href={item.link || "/notifications"}
									onClick={() => {
										markOneAsRead(item.id).catch(() => {});
										setOpen(false);
									}}
									className={`block px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${
										item.is_read ? "" : "bg-green-50/70 dark:bg-green-900/20"
									}`}
								>
									<p className="text-sm font-medium text-gray-900 dark:text-white">
										{item.title || "Notification"}
									</p>
									<p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
										{item.message || "You have a new update."}
									</p>
									<p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
										{formatDate(item.created_at)}
									</p>
								</Link>
							))
						)}
					</div>

					<div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
						<Link
							href="/notifications"
							onClick={() => setOpen(false)}
							className="text-sm text-green-600 hover:text-green-700 font-medium"
						>
							View all notifications
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}

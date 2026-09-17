import { Check, Film, FolderOpen, Pencil, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import type { RecordingSessionSummary } from "@/lib/recordingSession";

function formatBytes(bytes: number): string {
	if (bytes <= 0) return "—";
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatCreatedAt(createdAtMs: number, locale: string): string {
	try {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(createdAtMs));
	} catch {
		return new Date(createdAtMs).toLocaleString();
	}
}

interface RecordingSessionsSidebarProps {
	/** Plain filesystem path of the currently open screen recording, if any. */
	activeScreenVideoPath: string | null;
	onOpenSession: (session: RecordingSessionSummary) => void;
	/** Bump to force a reload (e.g. when the sidebar becomes visible). */
	refreshToken: number;
	/** Notified after a session's display name changed on disk. */
	onSessionRenamed?: (session: RecordingSessionSummary) => void;
}

/**
 * Left-hand project list for the editor. Shows every finalized recording in the
 * app's recordings directory and reopens one on click.
 */
export function RecordingSessionsSidebar({
	activeScreenVideoPath,
	onOpenSession,
	refreshToken,
	onSessionRenamed,
}: RecordingSessionsSidebarProps) {
	const t = useScopedT("editor");
	const { locale } = useI18n();
	const [sessions, setSessions] = useState<RecordingSessionSummary[] | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const [isSavingRename, setIsSavingRename] = useState(false);
	const renameInputRef = useRef<HTMLInputElement | null>(null);

	const loadSessions = useCallback(async () => {
		setLoadFailed(false);
		try {
			const result = await window.electronAPI.listRecordedSessions();
			if (!result.success) {
				throw new Error(result.message || result.error || "listRecordedSessions failed");
			}
			setSessions(result.sessions ?? []);
		} catch (error) {
			console.error("Failed to list recordings:", error);
			setSessions([]);
			setLoadFailed(true);
		}
	}, []);

	// refreshToken is an intentional reload trigger (sidebar reopened / window
	// refocused); it is not referenced inside loadSessions itself.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload trigger
	useEffect(() => {
		void loadSessions();
	}, [loadSessions, refreshToken]);

	const startRename = useCallback((session: RecordingSessionSummary) => {
		setRenamingPath(session.screenVideoPath);
		setRenameDraft(session.name ?? "");
		requestAnimationFrame(() => {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		});
	}, []);

	const commitRename = useCallback(async () => {
		if (!renamingPath || isSavingRename) return;
		const targetPath = renamingPath;
		const currentSessions = sessions;
		setIsSavingRename(true);
		try {
			const result = await window.electronAPI.renameRecordedSession(
				targetPath,
				renameDraft.trim() || null,
			);
			if (!result.success || !result.session) {
				throw new Error(result.message || result.error || "renameRecordedSession failed");
			}
			const renamedSession = result.session;
			setSessions(
				(previous) =>
					previous?.map((session) =>
						session.screenVideoPath === targetPath
							? { ...session, name: renamedSession.name }
							: session,
					) ?? previous,
			);
			const updated = currentSessions?.find((session) => session.screenVideoPath === targetPath);
			if (updated) {
				onSessionRenamed?.({ ...updated, name: renamedSession.name });
			}
			setRenamingPath(null);
		} catch (error) {
			console.error("Failed to rename session:", error);
		} finally {
			setIsSavingRename(false);
		}
	}, [renamingPath, renameDraft, sessions, onSessionRenamed, isSavingRename]);

	const cancelRename = useCallback(() => {
		if (isSavingRename) return;
		setRenamingPath(null);
		setRenameDraft("");
	}, [isSavingRename]);

	return (
		// Width is controlled by the resizable Panel this sidebar lives in.
		<aside className="w-full min-h-0 flex flex-col border-r border-white/[0.07] bg-[#0b0c0e]">
			<header className="h-10 flex-shrink-0 flex items-center justify-between pl-3 pr-2 border-b border-white/[0.07]">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
					{t("sessionsSidebar.title")}
				</span>
				<button
					type="button"
					title={t("sessionsSidebar.refresh")}
					aria-label={t("sessionsSidebar.refresh")}
					onClick={() => void loadSessions()}
					className="p-1.5 rounded-md text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
				>
					<RefreshCw size={13} />
				</button>
			</header>

			<div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
				{loadFailed && (
					<button
						type="button"
						onClick={() => void loadSessions()}
						className="rounded-lg border border-white/[0.07] p-3 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors text-left"
					>
						{t("sessionsSidebar.refresh")}
					</button>
				)}

				{!loadFailed && sessions !== null && sessions.length === 0 && (
					<div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
						<Film size={18} className="text-white/20" />
						<span className="text-[11.5px] text-white/35 leading-snug">
							{t("sessionsSidebar.empty")}
						</span>
					</div>
				)}

				{sessions?.map((session) => {
					const active = activeScreenVideoPath === session.screenVideoPath;
					const isRenaming = renamingPath === session.screenVideoPath;
					const displayName = session.name ?? formatCreatedAt(session.createdAt, locale);
					return (
						<div
							key={session.screenVideoPath}
							className={`group relative rounded-lg border transition-colors ${
								active
									? "border-[#34B27B]/40 bg-[#34B27B]/10"
									: "border-transparent hover:bg-white/[0.05]"
							}`}
						>
							{isRenaming ? (
								<div className="flex items-center gap-1.5 p-2">
									<input
										ref={renameInputRef}
										value={renameDraft}
										onChange={(event) => setRenameDraft(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.preventDefault();
												void commitRename();
											} else if (event.key === "Escape") {
												event.preventDefault();
												cancelRename();
											}
										}}
										onBlur={() => void commitRename()}
										placeholder={formatCreatedAt(session.createdAt, locale)}
										maxLength={120}
										disabled={isSavingRename}
										className="min-w-0 flex-1 rounded-md border border-[#34B27B]/50 bg-black/40 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-[#34B27B] disabled:opacity-60"
									/>
									<button
										type="button"
										title={t("sessionsSidebar.renameSave")}
										aria-label={t("sessionsSidebar.renameSave")}
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => void commitRename()}
										disabled={isSavingRename}
										className="p-1 rounded text-[#34B27B] hover:bg-[#34B27B]/15 disabled:opacity-50"
									>
										<Check size={13} />
									</button>
									<button
										type="button"
										title={t("sessionsSidebar.renameCancel")}
										aria-label={t("sessionsSidebar.renameCancel")}
										onMouseDown={(event) => event.preventDefault()}
										onClick={cancelRename}
										disabled={isSavingRename}
										className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
									>
										<X size={13} />
									</button>
								</div>
							) : (
								<>
									<button
										type="button"
										onClick={() => onOpenSession(session)}
										onDoubleClick={() => startRename(session)}
										className="w-full text-left p-2.5 pr-[4.4rem] flex gap-2.5 items-start"
									>
										<div
											className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
												active ? "bg-[#34B27B]/20 text-[#34B27B]" : "bg-white/[0.06] text-white/50"
											}`}
										>
											<Film size={15} />
										</div>
										<div className="min-w-0 flex-1">
											<div
												className="text-[12px] font-medium text-slate-200 truncate"
												title={displayName}
											>
												{displayName}
											</div>
											<div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/35">
												<span className="flex-shrink-0">
													{session.name
														? formatCreatedAt(session.createdAt, locale)
														: formatBytes(session.screenVideoBytes)}
												</span>
												{session.name && (
													<>
														<span className="text-white/25">·</span>
														<span className="flex-shrink-0">
															{formatBytes(session.screenVideoBytes)}
														</span>
													</>
												)}
												{session.webcamVideoPath && (
													<span className="px-1.5 py-px rounded bg-white/[0.08] text-white/45 truncate">
														{t("sessionsSidebar.webcam")}
													</span>
												)}
											</div>
										</div>
									</button>
									<button
										type="button"
										title={t("sessionsSidebar.rename")}
										aria-label={t("sessionsSidebar.rename")}
										onClick={() => startRename(session)}
										className="absolute top-1.5 right-6 p-1 rounded text-white/30 hover:text-white/80 hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
									>
										<Pencil size={12} />
									</button>
									<button
										type="button"
										title={t("sessionsSidebar.reveal")}
										aria-label={t("sessionsSidebar.reveal")}
										onClick={() => void window.electronAPI.revealInFolder(session.screenVideoPath)}
										className="absolute top-1.5 right-1.5 p-1 rounded text-white/30 hover:text-white/80 hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
									>
										<FolderOpen size={12} />
									</button>
								</>
							)}
						</div>
					);
				})}
			</div>
		</aside>
	);
}

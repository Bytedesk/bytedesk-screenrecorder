import { Film, HardDrive, Mic, MonitorPlay, Timer, Webcam } from "lucide-react";
import { useMemo } from "react";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import type { CursorCaptureMode } from "@/lib/recordingSession";

export interface ProjectInfoData {
	/** User-assigned display name (may be undefined → falls back to date). */
	name?: string;
	createdAt: number;
	/** Screen video size in bytes. */
	screenVideoBytes: number;
	hasWebcam: boolean;
	cursorCaptureMode?: CursorCaptureMode;
	screenVideoPath: string;
	/** Loaded video resolution, when a video element is available. */
	width?: number;
	height?: number;
	/** Loaded video duration in seconds. */
	duration?: number;
}

function formatBytes(bytes: number): string {
	if (bytes <= 0) return "—";
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(seconds: number): string {
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ProjectInfoSectionProps {
	info: ProjectInfoData;
}

/**
 * Compact "current project" summary rendered at the top of the settings rail.
 * Shows identity (name/date), media stats (size/resolution/duration) and the
 * recording's audio/camera composition.
 */
export function ProjectInfoSection({ info }: ProjectInfoSectionProps) {
	const t = useScopedT("editor");
	const { locale } = useI18n();

	const createdAt = useMemo(() => {
		try {
			return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
				new Date(info.createdAt),
			);
		} catch {
			return new Date(info.createdAt).toLocaleString();
		}
	}, [info.createdAt, locale]);

	const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
		{
			icon: <Timer className="h-3 w-3" />,
			label: t("projectInfo.created"),
			value: createdAt,
		},
		{
			icon: <HardDrive className="h-3 w-3" />,
			label: t("projectInfo.size"),
			value: formatBytes(info.screenVideoBytes),
		},
	];
	if (info.width && info.height) {
		rows.push({
			icon: <MonitorPlay className="h-3 w-3" />,
			label: t("projectInfo.resolution"),
			value: `${info.width} × ${info.height}`,
		});
	}
	if (info.duration && Number.isFinite(info.duration) && info.duration > 0) {
		rows.push({
			icon: <Film className="h-3 w-3" />,
			label: t("projectInfo.duration"),
			value: formatDuration(info.duration),
		});
	}
	rows.push({
		icon: info.hasWebcam ? <Webcam className="h-3 w-3" /> : <Mic className="h-3 w-3" />,
		label: t("projectInfo.camera"),
		value: info.hasWebcam ? t("projectInfo.cameraOn") : t("projectInfo.cameraOff"),
	});
	if (info.cursorCaptureMode === "system") {
		rows.push({
			icon: <MonitorPlay className="h-3 w-3" />,
			label: t("projectInfo.cursor"),
			value: t("projectInfo.cursorSystem"),
		});
	}

	return (
		<section className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
			<div className="mb-2 flex items-center justify-between gap-2">
				<span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
					{t("projectInfo.title")}
				</span>
				<span
					className="truncate text-[11px] font-medium text-slate-300"
					title={info.name ?? createdAt}
				>
					{info.name ?? createdAt}
				</span>
			</div>
			<dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 items-center">
				{rows.map((row) => (
					<div
						key={row.label}
						className="col-span-2 grid grid-cols-[auto_1fr] gap-x-2.5 items-center"
					>
						<dt className="flex items-center gap-1.5 text-[10.5px] text-white/40">
							{row.icon}
							{row.label}
						</dt>
						<dd className="text-[11px] text-slate-300 text-right truncate" title={row.value}>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
			<div
				className="mt-2 pt-2 border-t border-white/[0.05] text-[9.5px] text-white/25 truncate"
				title={info.screenVideoPath}
			>
				{info.screenVideoPath}
			</div>
		</section>
	);
}

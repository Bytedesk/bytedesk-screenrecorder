import { describe, expect, it } from "vitest";
import {
	normalizeProjectMedia,
	normalizeRecordingSession,
	type RecordingSession,
} from "./recordingSession";

describe("normalizeRecordingSession", () => {
	it("keeps a valid display name", () => {
		const session = normalizeRecordingSession({
			screenVideoPath: "/tmp/recording.webm",
			createdAt: 1_700_000_000_000,
			name: "My demo recording",
		});
		expect(session).toMatchObject({
			screenVideoPath: "/tmp/recording.webm",
			createdAt: 1_700_000_000_000,
			name: "My demo recording",
		});
	});

	it("drops blank names instead of keeping empty strings", () => {
		const session = normalizeRecordingSession({
			screenVideoPath: "/tmp/recording.webm",
			createdAt: 1,
			name: "   ",
		});
		expect(session?.name).toBeUndefined();
	});

	it("fills createdAt with now when missing", () => {
		const before = Date.now();
		const session = normalizeRecordingSession({ screenVideoPath: "/tmp/a.webm" });
		expect(session?.createdAt).toBeGreaterThanOrEqual(before);
	});

	it("rejects payloads without a screen video path", () => {
		expect(normalizeRecordingSession({ createdAt: 1 })).toBeNull();
		expect(normalizeRecordingSession(null)).toBeNull();
	});
});

describe("normalizeProjectMedia", () => {
	it("round-trips webcam and cursor capture mode when present", () => {
		const media = normalizeProjectMedia({
			screenVideoPath: "/tmp/s.mp4",
			webcamVideoPath: "/tmp/s-webcam.webm",
			cursorCaptureMode: "system",
		});
		expect(media).toEqual({
			screenVideoPath: "/tmp/s.mp4",
			webcamVideoPath: "/tmp/s-webcam.webm",
			cursorCaptureMode: "system",
		});
	});

	it("normalizes an unknown cursor capture mode away", () => {
		const media = normalizeProjectMedia({
			screenVideoPath: "/tmp/s.mp4",
			cursorCaptureMode: "bogus",
		});
		expect(media).toEqual({ screenVideoPath: "/tmp/s.mp4" });
	});
});

// Type-level sanity: RecordingSession accepts an optional display name.
const _typeCheck: RecordingSession = {
	screenVideoPath: "/tmp/x.webm",
	createdAt: 0,
	name: "typed",
};
void _typeCheck;

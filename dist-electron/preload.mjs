"use strict";
const electron = require("electron");
const NATIVE_BRIDGE_CHANNEL = "native-bridge:invoke";
const ASSET_BASE_URL_ARG_PREFIX = "--asset-base-url=";
const assetBaseUrlArg = process.argv.find((arg) => arg.startsWith(ASSET_BASE_URL_ARG_PREFIX));
const assetBaseUrl = assetBaseUrlArg ? assetBaseUrlArg.slice(ASSET_BASE_URL_ARG_PREFIX.length) : "";
electron.contextBridge.exposeInMainWorld("electronAPI", {
  assetBaseUrl,
  invokeNativeBridge: (request) => {
    return electron.ipcRenderer.invoke(NATIVE_BRIDGE_CHANNEL, request);
  },
  hudOverlayHide: () => {
    electron.ipcRenderer.send("hud-overlay-hide");
  },
  hudOverlayClose: () => {
    electron.ipcRenderer.send("hud-overlay-close");
  },
  setHudOverlayIgnoreMouseEvents: (ignore) => {
    electron.ipcRenderer.send("hud-overlay-ignore-mouse-events", ignore);
  },
  moveHudOverlayBy: (deltaX, deltaY) => {
    electron.ipcRenderer.send("hud-overlay-move-by", deltaX, deltaY);
  },
  setHudOverlaySize: (width, height) => {
    electron.ipcRenderer.send("hud-overlay-set-size", width, height);
  },
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  },
  switchToEditor: () => {
    return electron.ipcRenderer.invoke("switch-to-editor");
  },
  switchToHud: () => {
    return electron.ipcRenderer.invoke("switch-to-hud");
  },
  startNewRecording: () => {
    return electron.ipcRenderer.invoke("start-new-recording");
  },
  openSourceSelector: () => {
    return electron.ipcRenderer.invoke("open-source-selector");
  },
  selectSource: (source) => {
    return electron.ipcRenderer.invoke("select-source", source);
  },
  getSelectedSource: () => {
    return electron.ipcRenderer.invoke("get-selected-source");
  },
  requestCameraAccess: () => {
    return electron.ipcRenderer.invoke("request-camera-access");
  },
  requestScreenAccess: () => {
    return electron.ipcRenderer.invoke("request-screen-access");
  },
  requestNativeMacCursorAccess: () => {
    return electron.ipcRenderer.invoke("request-native-mac-cursor-access");
  },
  storeRecordedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("store-recorded-video", videoData, fileName);
  },
  storeRecordedSession: (payload) => {
    return electron.ipcRenderer.invoke("store-recorded-session", payload);
  },
  openRecordingStream: (fileName) => {
    return electron.ipcRenderer.invoke("open-recording-stream", fileName);
  },
  appendRecordingChunk: (fileName, chunk) => {
    return electron.ipcRenderer.invoke("append-recording-chunk", fileName, chunk);
  },
  closeRecordingStream: (fileName) => {
    return electron.ipcRenderer.invoke("close-recording-stream", fileName);
  },
  getRecordedVideoPath: () => {
    return electron.ipcRenderer.invoke("get-recorded-video-path");
  },
  listRecordedSessions: () => {
    return electron.ipcRenderer.invoke("list-recorded-sessions");
  },
  setRecordingState: (recording, recordingId, cursorCaptureMode) => {
    return electron.ipcRenderer.invoke("set-recording-state", recording, recordingId, cursorCaptureMode);
  },
  isNativeWindowsCaptureAvailable: () => {
    return electron.ipcRenderer.invoke("is-native-windows-capture-available");
  },
  isNativeMacCaptureAvailable: () => {
    return electron.ipcRenderer.invoke("is-native-mac-capture-available");
  },
  startNativeWindowsRecording: (request) => {
    return electron.ipcRenderer.invoke("start-native-windows-recording", request);
  },
  stopNativeWindowsRecording: (discard) => {
    return electron.ipcRenderer.invoke("stop-native-windows-recording", discard);
  },
  pauseNativeWindowsRecording: () => {
    return electron.ipcRenderer.invoke("pause-native-windows-recording");
  },
  resumeNativeWindowsRecording: () => {
    return electron.ipcRenderer.invoke("resume-native-windows-recording");
  },
  startNativeMacRecording: (request) => {
    return electron.ipcRenderer.invoke("start-native-mac-recording", request);
  },
  pauseNativeMacRecording: () => {
    return electron.ipcRenderer.invoke("pause-native-mac-recording");
  },
  resumeNativeMacRecording: () => {
    return electron.ipcRenderer.invoke("resume-native-mac-recording");
  },
  stopNativeMacRecording: (discard) => {
    return electron.ipcRenderer.invoke("stop-native-mac-recording", discard);
  },
  attachNativeMacWebcamRecording: (payload) => {
    return electron.ipcRenderer.invoke("attach-native-mac-webcam-recording", payload);
  },
  getCursorTelemetry: (videoPath) => {
    return electron.ipcRenderer.invoke("get-cursor-telemetry", videoPath);
  },
  discardCursorTelemetry: (recordingId) => {
    return electron.ipcRenderer.invoke("discard-cursor-telemetry", recordingId);
  },
  onStopRecordingFromTray: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("stop-recording-from-tray", listener);
    return () => electron.ipcRenderer.removeListener("stop-recording-from-tray", listener);
  },
  openExternalUrl: (url) => {
    return electron.ipcRenderer.invoke("open-external-url", url);
  },
  pickExportSavePath: (fileName, exportFolder) => {
    return electron.ipcRenderer.invoke("pick-export-save-path", fileName, exportFolder);
  },
  writeExportToPath: (videoData, filePath) => {
    return electron.ipcRenderer.invoke("write-export-to-path", videoData, filePath);
  },
  openVideoFilePicker: (options) => {
    return electron.ipcRenderer.invoke("open-video-file-picker", options);
  },
  renameRecordedSession: (screenVideoPath, name) => {
    return electron.ipcRenderer.invoke("rename-recorded-session", screenVideoPath, name);
  },
  approveVideoFilePaths: (filePaths) => {
    return electron.ipcRenderer.invoke("approve-video-file-paths", filePaths);
  },
  setCurrentVideoPath: (path) => {
    return electron.ipcRenderer.invoke("set-current-video-path", path);
  },
  setCurrentRecordingSession: (session) => {
    return electron.ipcRenderer.invoke("set-current-recording-session", session);
  },
  getCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("get-current-video-path");
  },
  getCurrentRecordingSession: () => {
    return electron.ipcRenderer.invoke("get-current-recording-session");
  },
  readBinaryFile: (filePath) => {
    return electron.ipcRenderer.invoke("read-binary-file", filePath);
  },
  preparePreviewAudioTrack: (filePath) => {
    return electron.ipcRenderer.invoke("prepare-preview-audio-track", filePath);
  },
  clearCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("clear-current-video-path");
  },
  saveProjectFile: (projectData, suggestedName, existingProjectPath) => {
    return electron.ipcRenderer.invoke("save-project-file", projectData, suggestedName, existingProjectPath);
  },
  loadProjectFile: (projectFolder) => {
    return electron.ipcRenderer.invoke("load-project-file", projectFolder);
  },
  loadProjectFileFromPath: (filePath) => {
    return electron.ipcRenderer.invoke("load-project-file-from-path", filePath);
  },
  saveProjectFileSilent: (projectData, targetPath) => {
    return electron.ipcRenderer.invoke("save-project-file-silent", projectData, targetPath);
  },
  getPathForFile: (file) => {
    try {
      return electron.webUtils.getPathForFile(file);
    } catch {
      return "";
    }
  },
  loadCurrentProjectFile: () => {
    return electron.ipcRenderer.invoke("load-current-project-file");
  },
  onMenuNewProject: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("menu-new-project", listener);
    return () => electron.ipcRenderer.removeListener("menu-new-project", listener);
  },
  onMenuImportVideo: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("menu-import-video", listener);
    return () => electron.ipcRenderer.removeListener("menu-import-video", listener);
  },
  onMenuLoadProject: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("menu-load-project", listener);
    return () => electron.ipcRenderer.removeListener("menu-load-project", listener);
  },
  onMenuSaveProject: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("menu-save-project", listener);
    return () => electron.ipcRenderer.removeListener("menu-save-project", listener);
  },
  onMenuSaveProjectAs: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("menu-save-project-as", listener);
    return () => electron.ipcRenderer.removeListener("menu-save-project-as", listener);
  },
  getPlatform: () => {
    return electron.ipcRenderer.invoke("get-platform");
  },
  revealInFolder: (filePath) => {
    return electron.ipcRenderer.invoke("reveal-in-folder", filePath);
  },
  getShortcuts: () => {
    return electron.ipcRenderer.invoke("get-shortcuts");
  },
  saveShortcuts: (shortcuts) => {
    return electron.ipcRenderer.invoke("save-shortcuts", shortcuts);
  },
  updateGlobalShortcut: (binding) => {
    return electron.ipcRenderer.invoke("update-global-shortcut", binding);
  },
  setLocale: (locale) => {
    return electron.ipcRenderer.invoke("set-locale", locale);
  },
  saveDiagnostic: (payload) => {
    return electron.ipcRenderer.invoke("save-diagnostic", payload);
  },
  setMicrophoneExpanded: (expanded) => {
    electron.ipcRenderer.send("hud:setMicrophoneExpanded", expanded);
  },
  setHasUnsavedChanges: (hasChanges) => {
    electron.ipcRenderer.send("set-has-unsaved-changes", hasChanges);
  },
  showCountdownOverlay: (value, runId) => {
    return electron.ipcRenderer.invoke("countdown-overlay-show", value, runId);
  },
  setCountdownOverlayValue: (value, runId) => {
    return electron.ipcRenderer.invoke("countdown-overlay-set-value", value, runId);
  },
  hideCountdownOverlay: (runId) => {
    return electron.ipcRenderer.invoke("countdown-overlay-hide", runId);
  },
  onCountdownOverlayValue: (callback) => {
    const listener = (_event, value) => callback(value);
    electron.ipcRenderer.on("countdown-overlay-value", listener);
    return () => electron.ipcRenderer.removeListener("countdown-overlay-value", listener);
  },
  onRequestSaveBeforeClose: (callback) => {
    const listener = async () => {
      try {
        const shouldClose = await callback();
        electron.ipcRenderer.send("save-before-close-done", shouldClose);
      } catch {
        electron.ipcRenderer.send("save-before-close-done", false);
      }
    };
    electron.ipcRenderer.on("request-save-before-close", listener);
    return () => electron.ipcRenderer.removeListener("request-save-before-close", listener);
  },
  onRequestCloseConfirm: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("request-close-confirm", listener);
    return () => electron.ipcRenderer.removeListener("request-close-confirm", listener);
  },
  sendCloseConfirmResponse: (choice) => {
    electron.ipcRenderer.send("close-confirm-response", choice);
  }
});

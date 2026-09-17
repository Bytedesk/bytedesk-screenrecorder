import fs, { unlink } from "node:fs/promises";
import path, { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { systemPreferences, screen, app, ipcMain, desktopCapturer, dialog, shell, clipboard, globalShortcut, BrowserWindow, nativeImage, session, Menu, Tray } from "electron";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { accessSync, constants, existsSync, createWriteStream } from "node:fs";
import os from "node:os";
function normalizeCursorCaptureMode(value) {
  return value === "editable-overlay" || value === "system" ? value : void 0;
}
function normalizePath$1(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function normalizeProjectMedia(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const raw = candidate;
  const screenVideoPath = normalizePath$1(raw.screenVideoPath);
  if (!screenVideoPath) {
    return null;
  }
  const webcamVideoPath = normalizePath$1(raw.webcamVideoPath);
  const cursorCaptureMode = normalizeCursorCaptureMode(raw.cursorCaptureMode);
  return {
    screenVideoPath,
    ...webcamVideoPath ? { webcamVideoPath } : {},
    ...cursorCaptureMode ? { cursorCaptureMode } : {}
  };
}
function normalizeRecordingSession(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const raw = candidate;
  const media = normalizeProjectMedia(raw);
  if (!media) {
    return null;
  }
  const name = normalizePath$1(raw.name);
  return {
    ...media,
    createdAt: typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    ...name ? { name } : {}
  };
}
const actions$b = { "cancel": "الغاء", "save": "حفظ", "delete": "حذف", "close": "اغلاق", "share": "مشاركة", "done": "تم", "open": "فتح", "upload": "رفع", "export": "تصدير", "showInFolder": "عرض في المجلد", "file": "ملف", "edit": "تعديل", "view": "عرض", "window": "نافذة", "quit": "خروج", "stopRecording": "إيقاف التسجيل", "undo": "تراجع", "redo": "إعادة", "cut": "قص", "copy": "نسخ", "paste": "لصق", "selectAll": "تحديد الكل", "minimize": "تصغير", "reload": "إعادة تحميل", "forceReload": "إعادة تحميل إجبارية", "toggleDevTools": "أدوات المطور", "actualSize": "الحجم الفعلي", "zoomIn": "تكبير", "zoomOut": "تصغير", "toggleFullScreen": "ملء الشاشة", "recordingStatus": "جاري التسجيل: {{source}}", "about": "حول OpenScreen", "services": "خدمات", "hide": "إخفاء OpenScreen", "hideOthers": "إخفاء الآخرين", "unhide": "إظهار الكل" };
const playback$b = { "play": "تشغيل", "pause": "ايقاف مؤقت", "fullscreen": "ملء الشاشة", "exitFullscreen": "خروج من ملء الشاشة" };
const locale$b = { "name": "عربي", "short": "AR" };
const commonAr = {
  actions: actions$b,
  playback: playback$b,
  locale: locale$b
};
const tutorial$b = { "triggerLabel": "كيف يعمل القص", "title": "كيف يعمل القص", "description": "فهم كيفية قص الأجزاء غير المرغوب فيها من الفيديو الخاص بك.", "explanationBefore": "تعمل أداة القص من خلال تحديد المقاطع التي تريد", "remove": "إزالتها", "explanationMiddle": " — أي شيء", "covered": "مغطى", "explanationAfter": "بمقطع قص أحمر سيتم قصه عند التصدير.", "visualExample": "مثال مرئي", "removed": "مُزال", "kept": "مُحتفظ به", "part1": "الجزء 1", "part2": "الجزء 2", "part3": "الجزء 3", "finalVideo": "الفيديو النهائي", "step1Title": "1. إضافة قص", "step1DescriptionBefore": "اضغط على ", "step1DescriptionAfter": " أو انقر على أيقونة المقص لتحديد قسم لإزالته.", "step2Title": "2. تعديل", "step2Description": "اسحب حواف المنطقة الحمراء لتغطي بالضبط ما تريد قصه." };
const unsavedChanges$b = { "title": "تغييرات غير محفوظة", "message": "لديك تغييرات غير محفوظة.", "detail": "هل تريد حفظ مشروعك قبل الإغلاق؟", "saveAndClose": "حفظ وإغلاق", "discardAndClose": "تجاهل وإغلاق", "detailNewProject": "هل تريد حفظ مشروعك قبل إنشاء مشروع جديد؟", "saveAndNewProject": "حفظ وإنشاء مشروع جديد", "discardAndNewProject": "تجاهل وإنشاء مشروع جديد", "detailLoadProject": "هل تريد حفظ مشروعك قبل تحميل مشروع آخر؟", "saveAndLoadProject": "حفظ وتحميل مشروع", "discardAndLoadProject": "تجاهل وتحميل مشروع", "loadProject": "تحميل مشروع...", "saveProject": "حفظ المشروع...", "saveProjectAs": "حفظ المشروع باسم...", "detailOpenRecording": "هل تريد حفظ مشروعك قبل فتح تسجيل آخر؟", "saveAndOpenRecording": "حفظ وفتح", "discardAndOpenRecording": "تجاهل وفتح" };
const fileDialogs$b = { "saveGif": "حفظ GIF المصدر", "saveVideo": "حفظ الفيديو المصدر", "selectVideo": "حدد ملف فيديو", "saveProject": "حفظ مشروع OpenScreen", "openProject": "فتح مشروع OpenScreen", "gifImage": "صورة GIF", "mp4Video": "فيديو MP4", "videoFiles": "ملفات فيديو", "openscreenProject": "مشروع OpenScreen", "allFiles": "جميع الملفات" };
const dialogsAr = {
  "export": { "complete": "اكتمل التصدير", "yourFormatReady": "{{format}} الخاص بك جاهز", "showInFolder": "عرض في المجلد", "finalizingVideo": "جاري إنهاء تصدير الفيديو...", "compilingGifProgress": "جاري تجميع GIF... {{progress}}%", "compilingGifWait": "جاري تجميع GIF... قد يستغرق هذا بعض الوقت", "takeMoment": "قد يستغرق هذا لحظة...", "failed": "فشل التصدير", "tryAgain": "يرجى المحاولة مرة أخرى", "finalizingVideoTitle": "إنهاء الفيديو", "compilingGif": "تجميع GIF", "exportingFormat": "تصدير {{format}}", "compiling": "تجميع", "renderingFrames": "تصيير الإطارات", "processing": "جاري المعالجة...", "finalizing": "جاري الإنهاء...", "compilingStatus": "جاري التجميع...", "status": "الحالة", "format": "الصيغة", "frames": "الإطارات", "cancelExport": "إلغاء التصدير", "savedSuccessfully": "تم حفظ {{format}} بنجاح!" },
  tutorial: tutorial$b,
  unsavedChanges: unsavedChanges$b,
  fileDialogs: fileDialogs$b
};
const actions$a = { "cancel": "Cancel", "save": "Save", "delete": "Delete", "close": "Close", "share": "Share", "done": "Done", "open": "Open", "upload": "Upload", "export": "Export", "showInFolder": "Show in Folder", "file": "File", "edit": "Edit", "view": "View", "window": "Window", "quit": "Quit", "stopRecording": "Stop Recording", "undo": "Undo", "redo": "Redo", "cut": "Cut", "copy": "Copy", "paste": "Paste", "selectAll": "Select All", "minimize": "Minimize", "reload": "Reload", "forceReload": "Force Reload", "toggleDevTools": "Toggle Developer Tools", "actualSize": "Actual Size", "zoomIn": "Zoom In", "zoomOut": "Zoom Out", "toggleFullScreen": "Toggle Full Screen", "recordingStatus": "Recording: {{source}}", "about": "About OpenScreen", "services": "Services", "hide": "Hide OpenScreen", "hideOthers": "Hide Others", "unhide": "Show All" };
const playback$a = { "play": "Play", "pause": "Pause", "fullscreen": "Fullscreen", "exitFullscreen": "Exit Fullscreen" };
const locale$a = { "name": "English", "short": "EN" };
const commonEn = {
  actions: actions$a,
  playback: playback$a,
  locale: locale$a
};
const tutorial$a = { "triggerLabel": "How trimming works", "title": "How Trimming Works", "description": "Understanding how to cut out unwanted parts of your video.", "explanationBefore": "The Trim tool works by defining the segments you want to", "remove": "remove", "explanationMiddle": " — anything", "covered": "covered", "explanationAfter": "by a red trim segment will be cut out when you export.", "visualExample": "Visual Example", "removed": "REMOVED", "kept": "Kept", "part1": "Part 1", "part2": "Part 2", "part3": "Part 3", "finalVideo": "Final Video", "step1Title": "1. Add Trim", "step1DescriptionBefore": "Press ", "step1DescriptionAfter": " or click the scissors icon to mark a section for removal.", "step2Title": "2. Adjust", "step2Description": "Drag the edges of the red region to cover exactly what you want to cut out." };
const unsavedChanges$a = { "title": "Unsaved Changes", "message": "You have unsaved changes.", "detail": "Do you want to save your project before closing?", "saveAndClose": "Save & Close", "discardAndClose": "Discard & Close", "detailNewProject": "Do you want to save your project before creating a new one?", "saveAndNewProject": "Save & New Project", "discardAndNewProject": "Discard & New Project", "detailLoadProject": "Do you want to save your project before loading another one?", "saveAndLoadProject": "Save & Load Project", "discardAndLoadProject": "Discard & Load Project", "newProject": "New Project", "importVideo": "Import Video File…", "loadProject": "Load Project…", "saveProject": "Save Project…", "saveProjectAs": "Save Project As…", "detailOpenRecording": "Do you want to save your project before opening another recording?", "saveAndOpenRecording": "Save & Open Recording", "discardAndOpenRecording": "Discard & Open Recording" };
const fileDialogs$a = { "saveGif": "Save Exported GIF", "saveVideo": "Save Exported Video", "selectVideo": "Select Video File", "saveProject": "Save OpenScreen Project", "openProject": "Open OpenScreen Project", "gifImage": "GIF Image", "mp4Video": "MP4 Video", "videoFiles": "Video Files", "openscreenProject": "OpenScreen Project", "allFiles": "All Files" };
const dialogsEn = {
  "export": { "complete": "Export Complete", "yourFormatReady": "Your {{format}} is ready", "showInFolder": "Show in Folder", "finalizingVideo": "Finalizing video export...", "compilingGifProgress": "Compiling GIF... {{progress}}%", "compilingGifWait": "Compiling GIF... This may take a while", "takeMoment": "This may take a moment...", "failed": "Export Failed", "tryAgain": "Please try again", "finalizingVideoTitle": "Finalizing Video", "compilingGif": "Compiling GIF", "exportingFormat": "Exporting {{format}}", "compiling": "Compiling", "renderingFrames": "Rendering Frames", "processing": "Processing...", "finalizing": "Finalizing...", "compilingStatus": "Compiling...", "status": "Status", "format": "Format", "frames": "Frames", "cancelExport": "Cancel Export", "savedSuccessfully": "{{format}} saved successfully!" },
  tutorial: tutorial$a,
  unsavedChanges: unsavedChanges$a,
  fileDialogs: fileDialogs$a
};
const actions$9 = { "cancel": "Cancelar", "save": "Guardar", "delete": "Eliminar", "close": "Cerrar", "share": "Compartir", "done": "Listo", "open": "Abrir", "upload": "Subir", "export": "Exportar", "showInFolder": "Mostrar en carpeta", "file": "Archivo", "edit": "Editar", "view": "Vista", "window": "Ventana", "quit": "Salir", "stopRecording": "Detener grabación", "undo": "Deshacer", "redo": "Rehacer", "cut": "Cortar", "copy": "Copiar", "paste": "Pegar", "selectAll": "Seleccionar todo", "minimize": "Minimizar", "reload": "Recargar", "forceReload": "Forzar recarga", "toggleDevTools": "Alternar herramientas de desarrollador", "actualSize": "Tamaño real", "zoomIn": "Acercar", "zoomOut": "Alejar", "toggleFullScreen": "Alternar pantalla completa", "recordingStatus": "Grabando: {{source}}", "about": "Acerca de OpenScreen", "services": "Servicios", "hide": "Ocultar OpenScreen", "hideOthers": "Ocultar otros", "unhide": "Mostrar todo" };
const playback$9 = { "play": "Reproducir", "pause": "Pausar", "fullscreen": "Pantalla completa", "exitFullscreen": "Salir de pantalla completa" };
const locale$9 = { "name": "Español", "short": "ES" };
const commonEs = {
  actions: actions$9,
  playback: playback$9,
  locale: locale$9
};
const tutorial$9 = { "triggerLabel": "Cómo funciona el recorte", "title": "Cómo funciona el recorte", "description": "Aprende a eliminar las partes no deseadas de tu video.", "explanationBefore": "La herramienta de recorte funciona definiendo los segmentos que deseas", "remove": "eliminar", "explanationMiddle": " — cualquier parte", "covered": "cubierta", "explanationAfter": "por un segmento rojo será eliminada al exportar.", "visualExample": "Ejemplo visual", "removed": "ELIMINADO", "kept": "Conservado", "part1": "Parte 1", "part2": "Parte 2", "part3": "Parte 3", "finalVideo": "Video final", "step1Title": "1. Agregar recorte", "step1DescriptionBefore": "Presiona ", "step1DescriptionAfter": " o haz clic en el ícono de tijeras para marcar una sección a eliminar.", "step2Title": "2. Ajustar", "step2Description": "Arrastra los bordes de la región roja para cubrir exactamente lo que deseas eliminar." };
const unsavedChanges$9 = { "title": "Cambios sin guardar", "message": "Tienes cambios sin guardar.", "detail": "¿Deseas guardar tu proyecto antes de cerrar?", "saveAndClose": "Guardar y cerrar", "discardAndClose": "Descartar y cerrar", "detailNewProject": "¿Deseas guardar tu proyecto antes de crear uno nuevo?", "saveAndNewProject": "Guardar y nuevo proyecto", "discardAndNewProject": "Descartar y nuevo proyecto", "detailLoadProject": "¿Deseas guardar tu proyecto antes de cargar otro?", "saveAndLoadProject": "Guardar y cargar proyecto", "discardAndLoadProject": "Descartar y cargar proyecto", "loadProject": "Cargar proyecto…", "saveProject": "Guardar proyecto…", "saveProjectAs": "Guardar proyecto como…", "detailOpenRecording": "¿Quieres guardar tu proyecto antes de abrir otra grabación?", "saveAndOpenRecording": "Guardar y abrir grabación", "discardAndOpenRecording": "Descartar y abrir grabación" };
const fileDialogs$9 = { "saveGif": "Guardar GIF exportado", "saveVideo": "Guardar video exportado", "selectVideo": "Seleccionar archivo de video", "saveProject": "Guardar proyecto OpenScreen", "openProject": "Abrir proyecto OpenScreen", "gifImage": "Imagen GIF", "mp4Video": "Video MP4", "videoFiles": "Archivos de video", "openscreenProject": "Proyecto OpenScreen", "allFiles": "Todos los archivos" };
const dialogsEs = {
  "export": { "complete": "Exportación completada", "yourFormatReady": "Tu {{format}} está listo", "showInFolder": "Mostrar en carpeta", "finalizingVideo": "Finalizando exportación de video...", "compilingGifProgress": "Compilando GIF... {{progress}}%", "compilingGifWait": "Compilando GIF... Esto puede tardar un rato", "takeMoment": "Esto puede tardar un momento...", "failed": "La exportación falló", "tryAgain": "Por favor intenta de nuevo", "finalizingVideoTitle": "Finalizando video", "compilingGif": "Compilando GIF", "exportingFormat": "Exportando {{format}}", "compiling": "Compilando", "renderingFrames": "Renderizando cuadros", "processing": "Procesando...", "finalizing": "Finalizando...", "compilingStatus": "Compilando...", "status": "Estado", "format": "Formato", "frames": "Cuadros", "cancelExport": "Cancelar exportación", "savedSuccessfully": "¡{{format}} guardado exitosamente!" },
  tutorial: tutorial$9,
  unsavedChanges: unsavedChanges$9,
  fileDialogs: fileDialogs$9
};
const actions$8 = { "cancel": "Annuler", "save": "Enregistrer", "delete": "Supprimer", "close": "Fermer", "share": "Partager", "done": "Terminer", "open": "Ouvrir", "upload": "Téléverser", "export": "Exporter", "showInFolder": "Afficher dans le dossier", "file": "Fichier", "edit": "Éditer", "view": "Affichage", "window": "Fenêtre", "quit": "Quitter", "stopRecording": "Arrêter l'enregistrement", "undo": "Annuler", "redo": "Rétablir", "cut": "Couper", "copy": "Copier", "paste": "Coller", "selectAll": "Tout sélectionner", "minimize": "Réduire", "reload": "Recharger", "forceReload": "Forcer le rechargement", "toggleDevTools": "Afficher/masquer les outils de développement", "actualSize": "Taille réelle", "zoomIn": "Zoom avant", "zoomOut": "Zoom arrière", "toggleFullScreen": "Basculer en plein écran", "recordingStatus": "Enregistrement : {{source}}", "about": "À propos d’OpenScreen", "services": "Services", "hide": "Masquer OpenScreen", "hideOthers": "Masquer les autres", "unhide": "Tout afficher" };
const playback$8 = { "play": "Lecture", "pause": "Pause", "fullscreen": "Plein écran", "exitFullscreen": "Quitter le plein écran" };
const locale$8 = { "name": "Français", "short": "FR" };
const commonFr = {
  actions: actions$8,
  playback: playback$8,
  locale: locale$8
};
const tutorial$8 = { "triggerLabel": "Comment fonctionne la coupe", "title": "Comment fonctionne la coupe", "description": "Comprendre comment supprimer les parties indésirables de votre vidéo.", "explanationBefore": "L'outil Coupe fonctionne en définissant les segments que vous souhaitez", "remove": "supprimer", "explanationMiddle": " — tout ce qui est", "covered": "couvert", "explanationAfter": "par un segment de coupe rouge sera coupé lors de l'export.", "visualExample": "Exemple visuel", "removed": "SUPPRIMÉ", "kept": "Conservé", "part1": "Partie 1", "part2": "Partie 2", "part3": "Partie 3", "finalVideo": "Vidéo finale", "step1Title": "1. Ajouter une coupe", "step1DescriptionBefore": "Appuyez sur ", "step1DescriptionAfter": " ou cliquez sur l'icône ciseaux pour marquer une section à supprimer.", "step2Title": "2. Ajuster", "step2Description": "Faites glisser les bords de la région rouge pour couvrir exactement ce que vous souhaitez couper." };
const unsavedChanges$8 = { "title": "Modifications non enregistrées", "message": "Vous avez des modifications non enregistrées.", "detail": "Voulez-vous enregistrer votre projet avant de fermer ?", "saveAndClose": "Enregistrer et fermer", "discardAndClose": "Ignorer et fermer", "detailNewProject": "Voulez-vous enregistrer votre projet avant d'en créer un nouveau ?", "saveAndNewProject": "Enregistrer et nouveau projet", "discardAndNewProject": "Ignorer et nouveau projet", "detailLoadProject": "Voulez-vous enregistrer votre projet avant d'en charger un autre ?", "saveAndLoadProject": "Enregistrer et charger un projet", "discardAndLoadProject": "Ignorer et charger un projet", "loadProject": "Charger un projet…", "saveProject": "Enregistrer le projet…", "saveProjectAs": "Enregistrer le projet sous…", "detailOpenRecording": "Voulez-vous enregistrer votre projet avant d'ouvrir un autre enregistrement ?", "saveAndOpenRecording": "Enregistrer et ouvrir", "discardAndOpenRecording": "Ignorer et ouvrir" };
const fileDialogs$8 = { "saveGif": "Enregistrer le GIF exporté", "saveVideo": "Enregistrer la vidéo exportée", "selectVideo": "Sélectionner un fichier vidéo", "saveProject": "Enregistrer le projet OpenScreen", "openProject": "Ouvrir un projet OpenScreen", "gifImage": "Image GIF", "mp4Video": "Vidéo MP4", "videoFiles": "Fichiers vidéo", "openscreenProject": "Projet OpenScreen", "allFiles": "Tous les fichiers" };
const dialogsFr = {
  "export": { "complete": "Export terminé", "yourFormatReady": "Votre {{format}} est prêt", "showInFolder": "Afficher dans le dossier", "finalizingVideo": "Finalisation de l'export vidéo...", "compilingGifProgress": "Compilation du GIF... {{progress}}%", "compilingGifWait": "Compilation du GIF... Cela peut prendre un moment", "takeMoment": "Cela peut prendre un moment...", "failed": "Export échoué", "tryAgain": "Veuillez réessayer", "finalizingVideoTitle": "Finalisation de la vidéo", "compilingGif": "Compilation du GIF", "exportingFormat": "Export de {{format}}", "compiling": "Compilation en cours", "renderingFrames": "Rendu des images", "processing": "Traitement en cours...", "finalizing": "Finalisation...", "compilingStatus": "Compilation...", "status": "Statut", "format": "Format", "frames": "Images", "cancelExport": "Annuler l'export", "savedSuccessfully": "{{format}} enregistré avec succès !" },
  tutorial: tutorial$8,
  unsavedChanges: unsavedChanges$8,
  fileDialogs: fileDialogs$8
};
const actions$7 = { "cancel": "Annulla", "save": "Salva", "delete": "Elimina", "close": "Chiudi", "share": "Condividi", "done": "Fatto", "open": "Apri", "upload": "Carica", "export": "Esporta", "showInFolder": "Mostra nella cartella", "file": "File", "edit": "Modifica", "view": "Visualizza", "window": "Finestra", "quit": "Esci", "stopRecording": "Interrompi registrazione", "undo": "Annulla", "redo": "Ripeti", "cut": "Taglia", "copy": "Copia", "paste": "Incolla", "selectAll": "Seleziona tutto", "minimize": "Riduci a icona", "reload": "Ricarica", "forceReload": "Forza ricarica", "toggleDevTools": "Attiva/disattiva strumenti sviluppatore", "actualSize": "Dimensione effettiva", "zoomIn": "Ingrandisci", "zoomOut": "Riduci", "toggleFullScreen": "Attiva/disattiva schermo intero", "recordingStatus": "Registrazione: {{source}}", "about": "Info su OpenScreen", "services": "Servizi", "hide": "Nascondi OpenScreen", "hideOthers": "Nascondi gli altri", "unhide": "Mostra tutto" };
const playback$7 = { "play": "Riproduci", "pause": "Pausa", "fullscreen": "Schermo intero", "exitFullscreen": "Esci dallo schermo intero" };
const locale$7 = { "name": "Italiano", "short": "IT" };
const commonIt = {
  actions: actions$7,
  playback: playback$7,
  locale: locale$7
};
const tutorial$7 = { "triggerLabel": "Come funziona il taglio", "title": "Come funziona il taglio", "description": "Capire come eliminare le parti indesiderate del tuo video.", "explanationBefore": "Lo strumento Taglia funziona definendo i segmenti che vuoi", "remove": "rimuovere", "explanationMiddle": " — tutto ciò", "covered": "coperto", "explanationAfter": "da un segmento rosso verrà eliminato durante l'esportazione.", "visualExample": "Esempio visivo", "removed": "RIMOSSO", "kept": "Mantenuto", "part1": "Parte 1", "part2": "Parte 2", "part3": "Parte 3", "finalVideo": "Video finale", "step1Title": "1. Aggiungi taglio", "step1DescriptionBefore": "Premi ", "step1DescriptionAfter": " o clicca sull'icona delle forbici per contrassegnare una sezione da rimuovere.", "step2Title": "2. Regolazione", "step2Description": "Trascina i bordi della regione rossa per coprire esattamente ciò che vuoi eliminare." };
const unsavedChanges$7 = { "title": "Modifiche non salvate", "message": "Hai delle modifiche non salvate.", "detail": "Vuoi salvare il progetto prima di chiudere?", "saveAndClose": "Salva e chiudi", "discardAndClose": "Scarta e chiudi", "loadProject": "Carica progetto…", "saveProject": "Salva progetto…", "saveProjectAs": "Salva progetto come…", "detailOpenRecording": "Vuoi salvare il progetto prima di aprire un'altra registrazione?", "saveAndOpenRecording": "Salva e apri", "discardAndOpenRecording": "Scarta e apri" };
const fileDialogs$7 = { "saveGif": "Salva GIF esportata", "saveVideo": "Salva video esportato", "selectVideo": "Seleziona file video", "saveProject": "Salva progetto OpenScreen", "openProject": "Apri progetto OpenScreen", "gifImage": "Immagine GIF", "mp4Video": "Video MP4", "videoFiles": "File video", "openscreenProject": "Progetto OpenScreen", "allFiles": "Tutti i file" };
const dialogsIt = {
  "export": { "complete": "Esportazione completata", "yourFormatReady": "Il tuo {{format}} è pronto", "showInFolder": "Mostra nella cartella", "finalizingVideo": "Finalizzazione esportazione video...", "compilingGifProgress": "Compilazione GIF... {{progress}}%", "compilingGifWait": "Compilazione GIF... Potrebbe richiedere del tempo", "takeMoment": "Ci potrebbe impiegare un momento...", "failed": "Esportazione fallita", "tryAgain": "Riprova", "finalizingVideoTitle": "Finalizzazione video", "compilingGif": "Compilazione GIF", "exportingFormat": "Esportazione {{format}}", "compiling": "Compilazione", "renderingFrames": "Rendering fotogrammi", "processing": "Elaborazione...", "finalizing": "Finalizzazione...", "compilingStatus": "Compilazione...", "status": "Stato", "format": "Formato", "frames": "Fotogrammi", "cancelExport": "Annulla esportazione", "savedSuccessfully": "{{format}} salvato con successo!" },
  tutorial: tutorial$7,
  unsavedChanges: unsavedChanges$7,
  fileDialogs: fileDialogs$7
};
const actions$6 = { "cancel": "キャンセル", "save": "保存", "delete": "削除", "close": "閉じる", "share": "共有", "done": "完了", "open": "開く", "upload": "読み込む", "export": "エクスポート", "showInFolder": "フォルダに表示", "file": "ファイル", "edit": "編集", "view": "表示", "window": "ウィンドウ", "quit": "終了", "stopRecording": "録画を停止", "undo": "元に戻す", "redo": "やり直す", "cut": "切り取り", "copy": "コピー", "paste": "貼り付け", "selectAll": "すべて選択", "minimize": "最小化", "reload": "再読み込み", "forceReload": "強制再読み込み", "toggleDevTools": "開発者ツールを切り替え", "actualSize": "実際のサイズ", "zoomIn": "拡大", "zoomOut": "縮小", "toggleFullScreen": "フルスクリーンを切り替え", "recordingStatus": "録画中: {{source}}", "about": "OpenScreenについて", "services": "サービス", "hide": "OpenScreenを隠す", "hideOthers": "ほかを隠す", "unhide": "すべて表示" };
const playback$6 = { "play": "再生", "pause": "一時停止", "fullscreen": "全画面表示", "exitFullscreen": "全画面表示を終了" };
const locale$6 = { "name": "日本語", "short": "JA" };
const commonJa = {
  actions: actions$6,
  playback: playback$6,
  locale: locale$6
};
const tutorial$6 = { "triggerLabel": "トリミングの仕組み", "title": "トリミングの仕組み", "description": "動画の不要な部分を削除する方法について解説します。", "explanationBefore": "トリムツールは、動画から", "remove": "「削除したい部分」", "explanationMiddle": "を指定することで機能します。エクスポート時には、赤い枠で", "covered": "囲まれた部分", "explanationAfter": "がすべてカットされます。", "visualExample": "視覚的な例", "removed": "削除", "kept": "保持", "part1": "パート 1", "part2": "パート 2", "part3": "パート 3", "finalVideo": "完成動画", "step1Title": "1. 削除範囲を追加", "step1DescriptionBefore": "キーボードの", "step1DescriptionAfter": "、またはハサミのアイコンをクリックして、削除したい範囲を指定します。", "step2Title": "2. 範囲を調整", "step2Description": "赤い領域の両端をドラッグして、削除したい範囲を正確に調整します。" };
const unsavedChanges$6 = { "title": "未保存の変更", "message": "未保存の変更があります。", "detail": "閉じる前にプロジェクトを保存しますか？", "saveAndClose": "保存して閉じる", "discardAndClose": "破棄して閉じる", "detailNewProject": "新しいプロジェクトを作成する前に保存しますか？", "saveAndNewProject": "保存して新規プロジェクト", "discardAndNewProject": "破棄して新規プロジェクト", "detailLoadProject": "別のプロジェクトを読み込む前にプロジェクトを保存しますか？", "saveAndLoadProject": "保存してプロジェクトを読み込む", "discardAndLoadProject": "破棄してプロジェクトを読み込む", "loadProject": "プロジェクトを読み込む…", "saveProject": "プロジェクトを保存…", "saveProjectAs": "プロジェクトを名前を付けて保存…", "detailOpenRecording": "別の録画を開く前にプロジェクトを保存しますか？", "saveAndOpenRecording": "保存して録画を開く", "discardAndOpenRecording": "破棄して録画を開く" };
const fileDialogs$6 = { "saveGif": "エクスポートしたGIFを保存", "saveVideo": "エクスポートした動画を保存", "selectVideo": "動画ファイルを選択", "saveProject": "OpenScreen プロジェクトを保存", "openProject": "OpenScreen プロジェクトを開く", "gifImage": "GIF 画像", "mp4Video": "MP4 動画", "videoFiles": "動画ファイル", "openscreenProject": "OpenScreen プロジェクト", "allFiles": "すべてのファイル" };
const dialogsJa = {
  "export": { "complete": "エクスポート完了", "yourFormatReady": "{{format}}の準備ができました", "showInFolder": "フォルダで表示", "finalizingVideo": "動画のエクスポートを仕上げています...", "compilingGifProgress": "GIFを生成中... {{progress}}%", "compilingGifWait": "GIFを生成中... しばらくお待ちください", "takeMoment": "少々お待ちください...", "failed": "エクスポートに失敗しました", "tryAgain": "もう一度お試しください", "finalizingVideoTitle": "動画の仕上げ", "compilingGif": "GIFを生成中", "exportingFormat": "{{format}}をエクスポート中", "compiling": "生成中", "renderingFrames": "フレームをレンダリング中", "processing": "処理中...", "finalizing": "最終処理中...", "compilingStatus": "生成中...", "status": "ステータス", "format": "フォーマット", "frames": "フレーム", "cancelExport": "エクスポートをキャンセル", "savedSuccessfully": "{{format}}を正常に保存しました！" },
  tutorial: tutorial$6,
  unsavedChanges: unsavedChanges$6,
  fileDialogs: fileDialogs$6
};
const actions$5 = { "cancel": "취소", "save": "저장", "delete": "삭제", "close": "닫기", "share": "공유", "done": "완료", "open": "열기", "upload": "업로드", "export": "내보내기", "showInFolder": "폴더에 표시", "file": "파일", "edit": "편집", "view": "보기", "window": "창", "quit": "종료", "stopRecording": "녹화 중지", "undo": "실행 취소", "redo": "다시 실행", "cut": "잘라내기", "copy": "복사", "paste": "붙여넣기", "selectAll": "모두 선택", "minimize": "최소화", "reload": "새로고침", "forceReload": "강제 새로고침", "toggleDevTools": "개발자 도구 전환", "actualSize": "실제 크기", "zoomIn": "확대", "zoomOut": "축소", "toggleFullScreen": "전체 화면 전환", "recordingStatus": "녹화 중: {{source}}", "about": "OpenScreen 정보", "services": "서비스", "hide": "OpenScreen 숨기기", "hideOthers": "다른 항목 숨기기", "unhide": "모두 보기" };
const playback$5 = { "play": "재생", "pause": "일시정지", "fullscreen": "전체화면", "exitFullscreen": "전체화면 종료" };
const locale$5 = { "name": "한국어", "short": "KO" };
const commonKo = {
  actions: actions$5,
  playback: playback$5,
  locale: locale$5
};
const tutorial$5 = { "triggerLabel": "트리밍 사용법", "title": "트리밍 사용법", "description": "비디오에서 불필요한 부분을 잘라내는 방법을 알아보세요.", "explanationBefore": "트림 도구는 제거할 구간을", "remove": "지정", "explanationMiddle": "하는 방식으로 동작합니다 —", "covered": "빨간 트림 구간으로 덮인", "explanationAfter": "부분은 내보낼 때 잘려나갑니다.", "visualExample": "화면 예시", "removed": "제거됨", "kept": "유지됨", "part1": "파트 1", "part2": "파트 2", "part3": "파트 3", "finalVideo": "최종 비디오", "step1Title": "1. 트림 추가", "step1DescriptionBefore": "", "step1DescriptionAfter": "키를 누르거나 가위 아이콘을 클릭해 제거할 구간을 표시하세요.", "step2Title": "2. 조정", "step2Description": "빨간 구간의 가장자리를 드래그해 잘라낼 범위를 설정하세요." };
const unsavedChanges$5 = { "title": "저장되지 않은 변경 사항", "message": "저장되지 않은 변경 사항이 있습니다.", "detail": "닫기 전에 프로젝트를 저장하시겠습니까?", "saveAndClose": "저장 후 닫기", "discardAndClose": "저장하지 않고 닫기", "detailNewProject": "새 프로젝트를 만들기 전에 저장하시겠습니까?", "saveAndNewProject": "저장 후 새 프로젝트", "discardAndNewProject": "저장하지 않고 새 프로젝트", "detailLoadProject": "다른 프로젝트를 불러오기 전에 저장하시겠습니까?", "saveAndLoadProject": "저장 후 프로젝트 불러오기", "discardAndLoadProject": "저장하지 않고 프로젝트 불러오기", "loadProject": "프로젝트 불러오기...", "saveProject": "프로젝트 저장...", "saveProjectAs": "다른 이름으로 프로젝트 저장...", "detailOpenRecording": "다른 녹화를 열기 전에 프로젝트를 저장하시겠습니까?", "saveAndOpenRecording": "저장하고 녹화 열기", "discardAndOpenRecording": "버리고 녹화 열기" };
const fileDialogs$5 = { "saveGif": "내보낸 GIF 저장", "saveVideo": "내보낸 비디오 저장", "selectVideo": "비디오 파일 선택", "saveProject": "OpenScreen 프로젝트 저장", "openProject": "OpenScreen 프로젝트 열기", "gifImage": "GIF 이미지", "mp4Video": "MP4 비디오", "videoFiles": "비디오 파일", "openscreenProject": "OpenScreen 프로젝트", "allFiles": "모든 파일" };
const dialogsKo = {
  "export": { "complete": "내보내기 완료", "yourFormatReady": "{{format}} 파일이 준비되었습니다", "showInFolder": "폴더에서 보기", "finalizingVideo": "비디오 내보내기 마무리 중...", "compilingGifProgress": "GIF 생성 중... {{progress}}%", "compilingGifWait": "GIF 생성 중... 잠시 시간이 걸릴 수 있습니다", "takeMoment": "잠시 기다려 주세요...", "failed": "내보내기 실패", "tryAgain": "다시 시도해 주세요", "finalizingVideoTitle": "비디오 마무리 중", "compilingGif": "GIF 생성 중", "exportingFormat": "{{format}} 내보내는 중", "compiling": "생성 중...", "renderingFrames": "프레임 렌더링 중", "processing": "처리 중...", "finalizing": "마무리 중...", "compilingStatus": "생성 중...", "status": "상태", "format": "형식", "frames": "프레임", "cancelExport": "내보내기 취소", "savedSuccessfully": "{{format}} 저장이 완료되었습니다!" },
  tutorial: tutorial$5,
  unsavedChanges: unsavedChanges$5,
  fileDialogs: fileDialogs$5
};
const actions$4 = { "cancel": "Отмена", "save": "Сохранить", "delete": "Удалить", "close": "Закрыть", "share": "Поделиться", "done": "Готово", "open": "Открыть", "upload": "Загрузить", "export": "Экспорт", "showInFolder": "Показать в папке", "file": "Файл", "edit": "Редактировать", "view": "Вид", "window": "Окно", "quit": "Выход", "stopRecording": "Остановить запись", "undo": "Отменить", "redo": "Повторить", "cut": "Вырезать", "copy": "Копировать", "paste": "Вставить", "selectAll": "Выделить всё", "minimize": "Свернуть", "reload": "Перезагрузить", "forceReload": "Принудительная перезагрузка", "toggleDevTools": "Переключить инструменты разработчика", "actualSize": "Реальный размер", "zoomIn": "Увеличить", "zoomOut": "Уменьшить", "toggleFullScreen": "Полноэкранный режим", "recordingStatus": "Запись: {{source}}", "about": "О OpenScreen", "services": "Сервисы", "hide": "Скрыть OpenScreen", "hideOthers": "Скрыть остальные", "unhide": "Показать все" };
const playback$4 = { "play": "Воспроизвести", "pause": "Пауза", "fullscreen": "Полный экран", "exitFullscreen": "Выход из полного экрана" };
const locale$4 = { "name": "Русский", "short": "RU" };
const commonRu = {
  actions: actions$4,
  playback: playback$4,
  locale: locale$4
};
const tutorial$4 = { "triggerLabel": "Как работает обрезка", "title": "Как работает обрезка", "description": "Как вырезать ненужные части видео.", "explanationBefore": "Инструмент обрезки работает путём определения сегментов, которые вы хотите", "remove": "удалить", "explanationMiddle": " — всё, что", "covered": "покрыто", "explanationAfter": "красным сегментом обрезки, будет вырезано при экспорте.", "visualExample": "Визуальный пример", "removed": "УДАЛЕНО", "kept": "Сохранено", "part1": "Часть 1", "part2": "Часть 2", "part3": "Часть 3", "finalVideo": "Итоговое видео", "step1Title": "1. Добавить обрезку", "step1DescriptionBefore": "Нажмите ", "step1DescriptionAfter": " или нажмите на значок ножниц, чтобы отметить секцию для удаления.", "step2Title": "2. Настроить", "step2Description": "Перетащите края красной области, чтобы точно покрыть то, что вы хотите вырезать." };
const unsavedChanges$4 = { "title": "Несохранённые изменения", "message": "У вас есть несохранённые изменения.", "detail": "Хотите сохранить проект перед закрытием?", "saveAndClose": "Сохранить и закрыть", "discardAndClose": "Отменить и закрыть", "detailNewProject": "Хотите сохранить проект перед созданием нового?", "saveAndNewProject": "Сохранить и новый проект", "discardAndNewProject": "Отменить и новый проект", "detailLoadProject": "Хотите сохранить проект перед загрузкой другого?", "saveAndLoadProject": "Сохранить и загрузить проект", "discardAndLoadProject": "Отменить и загрузить проект", "loadProject": "Загрузить проект…", "saveProject": "Сохранить проект…", "saveProjectAs": "Сохранить проект как…", "detailOpenRecording": "Сохранить проект перед открытием другой записи?", "saveAndOpenRecording": "Сохранить и открыть", "discardAndOpenRecording": "Отменить и открыть" };
const fileDialogs$4 = { "saveGif": "Сохранить экспортированный GIF", "saveVideo": "Сохранить экспортированное видео", "selectVideo": "Выбрать видеофайл", "saveProject": "Сохранить проект OpenScreen", "openProject": "Открыть проект OpenScreen", "gifImage": "GIF изображение", "mp4Video": "MP4 видео", "videoFiles": "Видеофайлы", "openscreenProject": "Проект OpenScreen", "allFiles": "Все файлы" };
const dialogsRu = {
  "export": { "complete": "Экспорт завершён", "yourFormatReady": "Ваш {{format}} готов", "showInFolder": "Показать в папке", "finalizingVideo": "Завершение экспорта видео...", "compilingGifProgress": "Сборка GIF... {{progress}}%", "compilingGifWait": "Сборка GIF... Это может занять некоторое время", "takeMoment": "Это может занять некоторое время...", "failed": "Экспорт не удался", "tryAgain": "Пожалуйста, попробуйте снова", "finalizingVideoTitle": "Завершение видео", "compilingGif": "Сборка GIF", "exportingFormat": "Экспорт {{format}}", "compiling": "Сборка", "renderingFrames": "Рендеринг кадров", "processing": "Обработка...", "finalizing": "Завершение...", "compilingStatus": "Сборка...", "status": "Статус", "format": "Формат", "frames": "Кадры", "cancelExport": "Отменить экспорт", "savedSuccessfully": "{{format}} успешно сохранён!" },
  tutorial: tutorial$4,
  unsavedChanges: unsavedChanges$4,
  fileDialogs: fileDialogs$4
};
const actions$3 = { "cancel": "İptal", "save": "Kaydet", "delete": "Sil", "close": "Kapat", "share": "Paylaş", "done": "Tamam", "open": "Aç", "upload": "Yükle", "export": "Dışa Aktar", "showInFolder": "Klasörde Göster", "file": "Dosya", "edit": "Düzenle", "view": "Görünüm", "window": "Pencere", "quit": "Çıkış", "stopRecording": "Kaydı Durdur", "undo": "Geri Al", "redo": "Yinele", "cut": "Kes", "copy": "Kopyala", "paste": "Yapıştır", "selectAll": "Tümünü Seç", "minimize": "Simge Durumuna Küçült", "reload": "Yeniden Yükle", "forceReload": "Zorla Yeniden Yükle", "toggleDevTools": "Geliştirici Araçlarını Aç/Kapat", "actualSize": "Gerçek Boyut", "zoomIn": "Yakınlaştır", "zoomOut": "Uzaklaştır", "toggleFullScreen": "Tam Ekranı Aç/Kapat", "recordingStatus": "Kaydediliyor: {{source}}", "about": "OpenScreen Hakkında", "services": "Servisler", "hide": "OpenScreen’i Gizle", "hideOthers": "Diğerlerini Gizle", "unhide": "Tümünü Göster" };
const playback$3 = { "play": "Oynat", "pause": "Duraklat", "fullscreen": "Tam Ekran", "exitFullscreen": "Tam Ekrandan Çık" };
const locale$3 = { "name": "Türkçe", "short": "TR" };
const commonTr = {
  actions: actions$3,
  playback: playback$3,
  locale: locale$3
};
const tutorial$3 = { "triggerLabel": "Kırpma nasıl çalışır", "title": "Kırpma Nasıl Çalışır", "description": "Videonuzun istenmeyen bölümlerini nasıl keseceğinizi anlayın.", "explanationBefore": "Kırpma aracı, istediğiniz bölümleri", "remove": "kaldırmak", "explanationMiddle": " için kullanılır; kırmızı kırpma bölgesiyle", "covered": "kaplanan", "explanationAfter": "her şey dışa aktarımda kesilecektir.", "visualExample": "Görsel Örnek", "removed": "KALDIRILDI", "kept": "Korundu", "part1": "Bölüm 1", "part2": "Bölüm 2", "part3": "Bölüm 3", "finalVideo": "Son Video", "step1Title": "1. Kırpma Ekle", "step1DescriptionBefore": "Kaldırılacak bölümü işaretlemek için ", "step1DescriptionAfter": " tuşuna basın veya makas simgesine tıklayın.", "step2Title": "2. Ayarla", "step2Description": "Kesmek istediğiniz kısmı tam olarak kaplamak için kırmızı bölgenin kenarlarını sürükleyin." };
const unsavedChanges$3 = { "title": "Kaydedilmemiş Değişiklikler", "message": "Kaydedilmemiş değişiklikleriniz var.", "detail": "Kapatmadan önce projenizi kaydetmek ister misiniz?", "saveAndClose": "Kaydet ve Kapat", "discardAndClose": "Kaydetmeden Kapat", "detailNewProject": "Yeni proje oluşturmadan önce kaydetmek ister misiniz?", "saveAndNewProject": "Kaydet ve Yeni Proje", "discardAndNewProject": "Kaydetmeden Yeni Proje", "detailLoadProject": "Başka bir proje yüklemeden önce kaydetmek ister misiniz?", "saveAndLoadProject": "Kaydet ve Proje Yükle", "discardAndLoadProject": "Kaydetmeden Proje Yükle", "loadProject": "Proje Yükle…", "saveProject": "Proje Kaydet…", "saveProjectAs": "Farklı Kaydet…", "detailOpenRecording": "Başka bir kaydı açmadan önce projenizi kaydetmek istiyor musunuz?", "saveAndOpenRecording": "Kaydet ve Aç", "discardAndOpenRecording": "At ve Aç" };
const fileDialogs$3 = { "saveGif": "Dışa Aktarılan GIF'i Kaydet", "saveVideo": "Dışa Aktarılan Videoyu Kaydet", "selectVideo": "Video Dosyası Seç", "saveProject": "OpenScreen Projesini Kaydet", "openProject": "OpenScreen Projesini Aç", "gifImage": "GIF Görüntüsü", "mp4Video": "MP4 Video", "videoFiles": "Video Dosyaları", "openscreenProject": "OpenScreen Projesi", "allFiles": "Tüm Dosyalar" };
const dialogsTr = {
  "export": { "complete": "Dışa Aktarım Tamamlandı", "yourFormatReady": "{{format}} dosyanız hazır", "showInFolder": "Klasörde Göster", "finalizingVideo": "Video dışa aktarımı sonlandırılıyor...", "compilingGifProgress": "GIF derleniyor... %{{progress}}", "compilingGifWait": "GIF derleniyor... Bu biraz zaman alabilir", "takeMoment": "Bu biraz zaman alabilir...", "failed": "Dışa Aktarım Başarısız", "tryAgain": "Lütfen tekrar deneyin", "finalizingVideoTitle": "Video Sonlandırılıyor", "compilingGif": "GIF Derleniyor", "exportingFormat": "{{format}} Dışa Aktarılıyor", "compiling": "Derleniyor", "renderingFrames": "Kareler İşleniyor", "processing": "İşleniyor...", "finalizing": "Sonlandırılıyor...", "compilingStatus": "Derleniyor...", "status": "Durum", "format": "Biçim", "frames": "Kareler", "cancelExport": "Dışa Aktarımı İptal Et", "savedSuccessfully": "{{format}} başarıyla kaydedildi!" },
  tutorial: tutorial$3,
  unsavedChanges: unsavedChanges$3,
  fileDialogs: fileDialogs$3
};
const actions$2 = { "cancel": "Hủy", "save": "Lưu", "delete": "Xóa", "close": "Đóng", "share": "Chia sẻ", "done": "Hoàn tất", "open": "Mở", "upload": "Tải lên", "export": "Xuất", "showInFolder": "Hiển thị trong thư mục", "file": "Tệp", "edit": "Chỉnh sửa", "view": "Xem", "window": "Cửa sổ", "quit": "Thoát", "stopRecording": "Dừng ghi hình", "undo": "Hoàn tác", "redo": "Làm lại", "cut": "Cắt", "copy": "Sao chép", "paste": "Dán", "selectAll": "Chọn tất cả", "minimize": "Thu nhỏ", "reload": "Tải lại", "forceReload": "Buộc tải lại", "toggleDevTools": "Bật/tắt công cụ nhà phát triển", "actualSize": "Kích thước thực", "zoomIn": "Phóng to", "zoomOut": "Thu nhỏ", "toggleFullScreen": "Bật/tắt toàn màn hình", "recordingStatus": "Đang ghi: {{source}}", "about": "Giới thiệu OpenScreen", "services": "Dịch vụ", "hide": "Ẩn OpenScreen", "hideOthers": "Ẩn ứng dụng khác", "unhide": "Hiển thị tất cả" };
const playback$2 = { "play": "Phát", "pause": "Tạm dừng", "fullscreen": "Toàn màn hình", "exitFullscreen": "Thoát toàn màn hình" };
const locale$2 = { "name": "Tiếng Việt", "short": "VI" };
const commonVi = {
  actions: actions$2,
  playback: playback$2,
  locale: locale$2
};
const tutorial$2 = { "triggerLabel": "Cách hoạt động của công cụ cắt", "title": "Cách cắt video", "description": "Hiểu cách cắt bỏ các phần không mong muốn trong video của bạn.", "explanationBefore": "Công cụ Cắt hoạt động bằng cách xác định các đoạn bạn muốn", "remove": "xóa", "explanationMiddle": " — bất cứ thứ gì", "covered": "được bao phủ", "explanationAfter": "bởi một đoạn cắt màu đỏ sẽ bị loại bỏ khi bạn xuất.", "visualExample": "Ví dụ trực quan", "removed": "ĐÃ XÓA", "kept": "Giữ lại", "part1": "Phần 1", "part2": "Phần 2", "part3": "Phần 3", "finalVideo": "Video cuối cùng", "step1Title": "1. Thêm đoạn cắt", "step1DescriptionBefore": "Nhấn ", "step1DescriptionAfter": " hoặc nhấp vào biểu tượng cái kéo để đánh dấu một phần cần xóa.", "step2Title": "2. Điều chỉnh", "step2Description": "Kéo các cạnh của vùng màu đỏ để bao phủ chính xác những gì bạn muốn cắt bỏ." };
const unsavedChanges$2 = { "title": "Thay đổi chưa được lưu", "message": "Bạn có các thay đổi chưa được lưu.", "detail": "Bạn có muốn lưu dự án của mình trước khi đóng không?", "saveAndClose": "Lưu & Đóng", "discardAndClose": "Bỏ qua & Đóng", "detailNewProject": "Bạn có muốn lưu dự án trước khi tạo dự án mới không?", "saveAndNewProject": "Lưu & Dự án mới", "discardAndNewProject": "Bỏ qua & Dự án mới", "detailLoadProject": "Bạn có muốn lưu dự án của mình trước khi tải dự án khác không?", "saveAndLoadProject": "Lưu & Tải dự án", "discardAndLoadProject": "Bỏ qua & Tải dự án", "loadProject": "Tải dự án…", "saveProject": "Lưu dự án…", "saveProjectAs": "Lưu dự án thành…", "detailOpenRecording": "Bạn có muốn lưu dự án trước khi mở bản ghi khác không?", "saveAndOpenRecording": "Lưu & Mở", "discardAndOpenRecording": "Bỏ & Mở" };
const fileDialogs$2 = { "saveGif": "Lưu GIF đã xuất", "saveVideo": "Lưu Video đã xuất", "selectVideo": "Chọn tệp video", "saveProject": "Lưu dự án OpenScreen", "openProject": "Mở dự án OpenScreen", "gifImage": "Hình ảnh GIF", "mp4Video": "Video MP4", "videoFiles": "Tệp Video", "openscreenProject": "Dự án OpenScreen", "allFiles": "Tất cả các tệp" };
const dialogsVi = {
  "export": { "complete": "Xuất hoàn tất", "yourFormatReady": "{{format}} của bạn đã sẵn sàng", "showInFolder": "Hiển thị trong thư mục", "finalizingVideo": "Đang hoàn tất xuất video...", "compilingGifProgress": "Đang biên dịch GIF... {{progress}}%", "compilingGifWait": "Đang biên dịch GIF... Có thể mất một lúc", "takeMoment": "Có thể mất một chút thời gian...", "failed": "Xuất thất bại", "tryAgain": "Vui lòng thử lại", "finalizingVideoTitle": "Hoàn tất video", "compilingGif": "Biên dịch GIF", "exportingFormat": "Đang xuất {{format}}", "compiling": "Đang biên dịch", "renderingFrames": "Kết xuất khung hình", "processing": "Đang xử lý...", "finalizing": "Đang hoàn tất...", "compilingStatus": "Đang biên dịch...", "status": "Trạng thái", "format": "Định dạng", "frames": "Khung hình", "cancelExport": "Hủy xuất", "savedSuccessfully": "Đã lưu {{format}} thành công!" },
  tutorial: tutorial$2,
  unsavedChanges: unsavedChanges$2,
  fileDialogs: fileDialogs$2
};
const actions$1 = { "cancel": "取消", "save": "保存", "delete": "删除", "close": "关闭", "share": "分享", "done": "完成", "open": "打开", "upload": "上传", "export": "导出", "showInFolder": "在文件夹中显示", "file": "文件", "edit": "编辑", "view": "视图", "window": "窗口", "quit": "退出", "stopRecording": "停止录制", "undo": "撤销", "redo": "重做", "cut": "剪切", "copy": "复制", "paste": "粘贴", "selectAll": "全选", "minimize": "最小化", "reload": "重新加载", "forceReload": "强制重新加载", "toggleDevTools": "切换开发者工具", "actualSize": "实际大小", "zoomIn": "放大", "zoomOut": "缩小", "toggleFullScreen": "切换全屏", "recordingStatus": "正在录制：{{source}}", "about": "关于 OpenScreen", "services": "服务", "hide": "隐藏 OpenScreen", "hideOthers": "隐藏其他", "unhide": "显示全部" };
const playback$1 = { "play": "播放", "pause": "暂停", "fullscreen": "全屏", "exitFullscreen": "退出全屏" };
const locale$1 = { "name": "简体中文", "short": "简中" };
const commonZh = {
  actions: actions$1,
  playback: playback$1,
  locale: locale$1
};
const tutorial$1 = { "triggerLabel": "剪辑功能说明", "title": "剪辑功能说明", "description": "了解如何剪掉视频中不需要的部分。", "explanationBefore": "剪辑工具通过定义您要", "remove": "移除", "explanationMiddle": "——任何被", "covered": "覆盖", "explanationAfter": "的红色剪辑区域部分将在导出时被剪掉。", "visualExample": "示例演示", "removed": "已移除", "kept": "保留", "part1": "第 1 部分", "part2": "第 2 部分", "part3": "第 3 部分", "finalVideo": "最终视频", "step1Title": "1. 添加剪辑", "step1DescriptionBefore": "按", "step1DescriptionAfter": "键或点击剪刀图标来标记要移除的片段。", "step2Title": "2. 调整", "step2Description": "拖动红色区域的边缘，精确覆盖您要剪掉的部分。" };
const unsavedChanges$1 = { "title": "未保存的更改", "message": "您有未保存的更改。", "detail": "是否在关闭前保存项目？", "saveAndClose": "保存并关闭", "discardAndClose": "放弃并关闭", "detailNewProject": "是否在创建新项目前保存当前项目？", "saveAndNewProject": "保存并新建项目", "discardAndNewProject": "放弃并新建项目", "detailLoadProject": "是否在加载其他项目前保存当前项目？", "saveAndLoadProject": "保存并加载项目", "discardAndLoadProject": "放弃并加载项目", "loadProject": "加载项目…", "saveProject": "保存项目…", "saveProjectAs": "项目另存为…", "detailOpenRecording": "打开其他录像前是否保存当前项目？", "saveAndOpenRecording": "保存并打开录像", "discardAndOpenRecording": "丢弃并打开录像" };
const fileDialogs$1 = { "saveGif": "保存导出的 GIF", "saveVideo": "保存导出的视频", "selectVideo": "选择视频文件", "saveProject": "保存 OpenScreen 项目", "openProject": "打开 OpenScreen 项目", "gifImage": "GIF 图片", "mp4Video": "MP4 视频", "videoFiles": "视频文件", "openscreenProject": "OpenScreen 项目", "allFiles": "所有文件" };
const dialogsZh = {
  "export": { "complete": "导出完成", "yourFormatReady": "您的 {{format}} 已准备就绪", "showInFolder": "在文件夹中显示", "finalizingVideo": "正在完成视频导出...", "compilingGifProgress": "正在编译 GIF... {{progress}}%", "compilingGifWait": "正在编译 GIF... 这可能需要一些时间", "takeMoment": "这可能需要一点时间...", "failed": "导出失败", "tryAgain": "请重试", "finalizingVideoTitle": "正在完成视频", "compilingGif": "正在编译 GIF", "exportingFormat": "正在导出 {{format}}", "compiling": "编译中", "renderingFrames": "渲染帧", "processing": "处理中...", "finalizing": "正在完成...", "compilingStatus": "编译中...", "status": "状态", "format": "格式", "frames": "帧", "cancelExport": "取消导出", "savedSuccessfully": "{{format}} 保存成功！" },
  tutorial: tutorial$1,
  unsavedChanges: unsavedChanges$1,
  fileDialogs: fileDialogs$1
};
const actions = { "cancel": "取消", "save": "儲存", "delete": "刪除", "close": "關閉", "share": "分享", "done": "完成", "open": "開啟", "upload": "上傳", "export": "匯出", "showInFolder": "在資料夾中顯示", "file": "檔案", "edit": "編輯", "view": "檢視", "window": "視窗", "quit": "退出", "stopRecording": "停止錄製", "undo": "復原", "redo": "重做", "cut": "剪下", "copy": "複製", "paste": "貼上", "selectAll": "全選", "minimize": "最小化", "reload": "重新載入", "forceReload": "強制重新載入", "toggleDevTools": "切換開發者工具", "actualSize": "實際大小", "zoomIn": "放大", "zoomOut": "縮小", "toggleFullScreen": "切換全螢幕", "recordingStatus": "錄製中：{{source}}", "about": "關於 OpenScreen", "services": "服務", "hide": "隱藏 OpenScreen", "hideOthers": "隱藏其他", "unhide": "全部顯示" };
const playback = { "play": "播放", "pause": "暫停", "fullscreen": "全螢幕", "exitFullscreen": "退出全螢幕" };
const locale = { "name": "繁體中文", "short": "繁中" };
const commonZhTw = {
  actions,
  playback,
  locale
};
const tutorial = { "triggerLabel": "剪輯功能說明", "title": "剪輯功能說明", "description": "了解如何剪掉影片中不需要的部分。", "explanationBefore": "剪輯工具透過定義您要", "remove": "移除", "explanationMiddle": "——任何被", "covered": "覆蓋", "explanationAfter": "的紅色剪輯區域部分將在匯出時被剪掉。", "visualExample": "示例演示", "removed": "已移除", "kept": "保留", "part1": "第 1 部分", "part2": "第 2 部分", "part3": "第 3 部分", "finalVideo": "最終影片", "step1Title": "1. 添加剪輯", "step1DescriptionBefore": "按", "step1DescriptionAfter": "鍵或點擊剪刀圖示來標記要移除的片段。", "step2Title": "2. 調整", "step2Description": "拖動紅色區域的邊緣，精確覆蓋您要剪掉的部分。" };
const unsavedChanges = { "title": "未儲存的變更", "message": "您有未儲存的變更。", "detail": "是否在關閉前儲存專案？", "saveAndClose": "儲存並關閉", "discardAndClose": "捨棄並關閉", "detailNewProject": "是否在建立新專案前儲存目前的專案？", "saveAndNewProject": "儲存並建立新專案", "discardAndNewProject": "捨棄並建立新專案", "detailLoadProject": "是否在載入其他專案前儲存目前的專案？", "saveAndLoadProject": "儲存並載入專案", "discardAndLoadProject": "捨棄並載入專案", "loadProject": "載入專案…", "saveProject": "儲存專案…", "saveProjectAs": "專案另存新檔…", "detailOpenRecording": "開啟其他錄影前是否儲存目前專案？", "saveAndOpenRecording": "儲存並開啟錄影", "discardAndOpenRecording": "捨棄並開啟錄影" };
const fileDialogs = { "saveGif": "儲存匯出的 GIF", "saveVideo": "儲存匯出的影片", "selectVideo": "選擇影片檔案", "saveProject": "儲存 OpenScreen 專案", "openProject": "開啟 OpenScreen 專案", "gifImage": "GIF 圖片", "mp4Video": "MP4 影片", "videoFiles": "影片檔案", "openscreenProject": "OpenScreen 專案", "allFiles": "所有檔案" };
const dialogsZhTw = {
  "export": { "complete": "匯出完成", "yourFormatReady": "您的 {{format}} 已準備就緒", "showInFolder": "在資料夾中顯示", "finalizingVideo": "正在完成影片匯出...", "compilingGifProgress": "正在編譯 GIF... {{progress}}%", "compilingGifWait": "正在編譯 GIF... 這可能需要一些時間", "takeMoment": "這可能需要一點時間...", "failed": "匯出失敗", "tryAgain": "請重試", "finalizingVideoTitle": "正在完成影片", "compilingGif": "正在編譯 GIF", "exportingFormat": "正在匯出 {{format}}", "compiling": "編譯中", "renderingFrames": "渲染影格", "processing": "處理中...", "finalizing": "正在完成...", "compilingStatus": "編譯中...", "status": "狀態", "format": "格式", "frames": "影格", "cancelExport": "取消匯出", "savedSuccessfully": "{{format}} 儲存成功！" },
  tutorial,
  unsavedChanges,
  fileDialogs
};
const messages = {
  en: { common: commonEn, dialogs: dialogsEn },
  ar: { common: commonAr, dialogs: dialogsAr },
  es: { common: commonEs, dialogs: dialogsEs },
  fr: { common: commonFr, dialogs: dialogsFr },
  it: { common: commonIt, dialogs: dialogsIt },
  "ja-JP": { common: commonJa, dialogs: dialogsJa },
  "ko-KR": { common: commonKo, dialogs: dialogsKo },
  ru: { common: commonRu, dialogs: dialogsRu },
  tr: { common: commonTr, dialogs: dialogsTr },
  vi: { common: commonVi, dialogs: dialogsVi },
  "zh-CN": { common: commonZh, dialogs: dialogsZh },
  "zh-TW": { common: commonZhTw, dialogs: dialogsZhTw }
};
let currentLocale = "en";
function setMainLocale(locale2) {
  if (locale2 === "en" || locale2 === "ar" || locale2 === "es" || locale2 === "fr" || locale2 === "it" || locale2 === "ja-JP" || locale2 === "ko-KR" || locale2 === "ru" || locale2 === "tr" || locale2 === "vi" || locale2 === "zh-CN" || locale2 === "zh-TW") {
    currentLocale = locale2;
  }
}
function getMessageValue(obj, dotPath) {
  const keys = dotPath.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return void 0;
    current = current[key];
  }
  return typeof current === "string" ? current : void 0;
}
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}
function mainT(namespace, key, vars) {
  const value = getMessageValue(messages[currentLocale]?.[namespace], key) ?? getMessageValue(messages.en?.[namespace], key);
  if (value == null) return `${namespace}.${key}`;
  return interpolate(value, vars);
}
const HELPER_NAME = "openscreen-macos-cursor-helper";
const READY_TIMEOUT_MS$1 = 5e3;
function helperCandidates() {
  const envPath = process.env.OPENSCREEN_MAC_CURSOR_HELPER_EXE?.trim();
  const appRoot = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : process.cwd();
  const archTag = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  const resourceRoot = typeof process.resourcesPath === "string" ? process.resourcesPath : path.join(appRoot, "resources");
  return [
    envPath,
    path.join(appRoot, "electron", "native", "screencapturekit", "build", HELPER_NAME),
    path.join(appRoot, "electron", "native", "bin", archTag, HELPER_NAME),
    path.join(resourceRoot, "electron", "native", "bin", archTag, HELPER_NAME)
  ].filter((candidate) => Boolean(candidate));
}
function findMacCursorHelperPath() {
  for (const candidate of helperCandidates()) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function requestMacCursorAccessibilityAccess() {
  if (process.platform !== "darwin") {
    return { success: true, granted: true, status: "granted" };
  }
  try {
    systemPreferences.isTrustedAccessibilityClient(true);
  } catch {
  }
  const helperPath = findMacCursorHelperPath();
  if (!helperPath) {
    return { success: true, granted: false, status: "missing-helper" };
  }
  return new Promise(
    (resolve) => {
      const child = spawn(helperPath, [JSON.stringify({ sampleIntervalMs: 250 })], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let settled = false;
      let lineBuffer = "";
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (!child.killed) {
          child.kill("SIGTERM");
        }
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish({
          success: false,
          granted: false,
          status: "timeout",
          error: "Timed out waiting for macOS cursor helper"
        });
      }, READY_TIMEOUT_MS$1);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        lineBuffer += chunk;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          try {
            const event = JSON.parse(trimmed);
            if (event.type === "ready") {
              finish({
                success: true,
                granted: event.accessibilityTrusted === true,
                status: event.accessibilityTrusted === true ? "granted" : "not-determined"
              });
              return;
            }
          } catch {
          }
        }
      });
      child.once("error", (error) => {
        finish({
          success: false,
          granted: false,
          status: "error",
          error: error.message
        });
      });
      child.once("exit", (code, signal) => {
        finish({
          success: false,
          granted: false,
          status: "exited",
          error: `macOS cursor helper exited before ready (code=${code}, signal=${signal})`
        });
      });
    }
  );
}
function clamp$1(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function normalizeCursorType(value) {
  return value === "arrow" || value === "pointer" || value === "text" ? value : null;
}
class MacNativeCursorRecordingSession {
  constructor(options) {
    this.options = options;
  }
  options;
  samples = [];
  assets = /* @__PURE__ */ new Map();
  process = null;
  lineBuffer = "";
  startTimeMs = 0;
  fallbackInterval = null;
  readyResolve = null;
  readyReject = null;
  readyTimer = null;
  previousLeftButtonDown = false;
  consecutiveOutsideSamples = 0;
  // Hide only after this many consecutive out-of-bounds samples (~100ms at 33ms interval).
  // Fast swipes that briefly exit the display are clipped by clip-path instead of disappearing.
  static OUTSIDE_HIDE_THRESHOLD = 3;
  async start() {
    this.samples = [];
    this.assets.clear();
    this.lineBuffer = "";
    this.startTimeMs = this.options.startTimeMs ?? Date.now();
    this.previousLeftButtonDown = false;
    this.consecutiveOutsideSamples = 0;
    try {
      systemPreferences.isTrustedAccessibilityClient(true);
    } catch {
    }
    const helperPath = findMacCursorHelperPath();
    if (!helperPath) {
      this.startPositionOnlyFallback();
      return;
    }
    const child = spawn(
      helperPath,
      [
        JSON.stringify({
          sampleIntervalMs: this.options.sampleIntervalMs
        })
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    this.process = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.handleStdoutChunk(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      const message = chunk.trim();
      if (message) {
        console.error("[cursor-macos]", message);
      }
    });
    child.once("exit", (code, signal) => {
      this.rejectReady(
        new Error(`macOS cursor helper exited before ready (code=${code}, signal=${signal})`)
      );
      this.process = null;
    });
    child.once("error", (error) => {
      this.rejectReady(error);
      this.process = null;
    });
    try {
      await this.waitUntilReady();
    } catch (error) {
      this.killHelperProcess(child);
      this.process = null;
      console.warn("[cursor-macos] falling back to position-only cursor telemetry:", error);
      this.startPositionOnlyFallback();
    }
  }
  async stop() {
    const child = this.process;
    this.process = null;
    this.clearReadyState();
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    if (child) {
      this.killHelperProcess(child);
    }
    return {
      version: 2,
      provider: this.assets.size > 0 ? "native" : "none",
      samples: this.samples,
      assets: [...this.assets.values()]
    };
  }
  startPositionOnlyFallback() {
    this.captureSample(Date.now(), null, null, false, false, false);
    this.fallbackInterval = setInterval(() => {
      this.captureSample(Date.now(), null, null, false, false, false);
    }, this.options.sampleIntervalMs);
  }
  rememberAsset(asset) {
    if (!asset?.id || this.assets.has(asset.id)) {
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const displayScaleFactor = screen.getDisplayNearestPoint(cursor).scaleFactor;
    this.assets.set(asset.id, {
      id: asset.id,
      platform: "darwin",
      imageDataUrl: asset.imageDataUrl,
      width: asset.width,
      height: asset.height,
      hotspotX: asset.hotspotX,
      hotspotY: asset.hotspotY,
      scaleFactor: asset.scaleFactor ?? displayScaleFactor
    });
  }
  handleStdoutChunk(chunk) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }
      try {
        this.handleEvent(JSON.parse(trimmedLine));
      } catch (error) {
        console.error("Failed to parse macOS cursor helper output:", error, trimmedLine);
      }
    }
  }
  handleEvent(payload) {
    if (payload.type === "ready") {
      if (payload.accessibilityTrusted === false) {
        console.warn(
          "[cursor-macos] Accessibility is not trusted; text/pointer affordance detection disabled (bitmap capture still active)."
        );
      }
      this.resolveReady();
      return;
    }
    if (payload.type === "sample") {
      this.rememberAsset(payload.asset);
      this.captureSample(
        payload.timestampMs,
        normalizeCursorType(payload.cursorType),
        payload.assetId ?? null,
        payload.leftButtonDown === true,
        payload.leftButtonPressed === true,
        payload.leftButtonReleased === true
      );
    }
  }
  captureSample(timestampMs, cursorType, assetId, leftButtonDown, leftButtonPressed, leftButtonReleased) {
    const cursor = screen.getCursorScreenPoint();
    const bounds = this.options.getDisplayBounds() ?? screen.getDisplayNearestPoint(cursor).bounds;
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const normalizedX = (cursor.x - bounds.x) / width;
    const normalizedY = (cursor.y - bounds.y) / height;
    const isOutsideDisplay = normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1;
    if (isOutsideDisplay) {
      this.consecutiveOutsideSamples++;
    } else {
      this.consecutiveOutsideSamples = 0;
    }
    const visible = this.consecutiveOutsideSamples < MacNativeCursorRecordingSession.OUTSIDE_HIDE_THRESHOLD;
    const interactionType = leftButtonPressed || leftButtonDown && !this.previousLeftButtonDown ? "click" : leftButtonReleased || !leftButtonDown && this.previousLeftButtonDown ? "mouseup" : "move";
    this.previousLeftButtonDown = leftButtonDown;
    this.samples.push({
      timeMs: Math.max(0, timestampMs - this.startTimeMs),
      cx: clamp$1(normalizedX, 0, 1),
      cy: clamp$1(normalizedY, 0, 1),
      visible,
      interactionType,
      ...assetId ? { assetId } : {},
      ...cursorType ? { cursorType } : {}
    });
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }
  }
  waitUntilReady() {
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      this.readyTimer = setTimeout(() => {
        this.rejectReady(new Error("Timed out waiting for macOS cursor helper"));
      }, READY_TIMEOUT_MS$1);
    });
  }
  resolveReady() {
    const resolve = this.readyResolve;
    this.clearReadyState();
    resolve?.();
  }
  rejectReady(error) {
    const reject = this.readyReject;
    this.clearReadyState();
    reject?.(error);
  }
  clearReadyState() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.readyResolve = null;
    this.readyReject = null;
  }
  killHelperProcess(child) {
    if (child.killed) {
      return;
    }
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 500).unref();
  }
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
class TelemetryRecordingSession {
  constructor(options) {
    this.options = options;
  }
  options;
  samples = [];
  interval = null;
  startTimeMs = 0;
  async start() {
    this.samples = [];
    this.startTimeMs = this.options.startTimeMs ?? Date.now();
    this.captureSample();
    this.interval = setInterval(() => {
      this.captureSample();
    }, this.options.sampleIntervalMs);
  }
  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    return {
      version: 2,
      provider: "none",
      samples: this.samples,
      assets: []
    };
  }
  captureSample() {
    const cursor = screen.getCursorScreenPoint();
    const display = this.options.getDisplayBounds() ?? screen.getDisplayNearestPoint(cursor).bounds;
    const width = Math.max(1, display.width);
    const height = Math.max(1, display.height);
    this.samples.push({
      timeMs: Math.max(0, Date.now() - this.startTimeMs),
      cx: clamp((cursor.x - display.x) / width, 0, 1),
      cy: clamp((cursor.y - display.y) / height, 0, 1),
      visible: true
    });
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }
  }
}
function parseWindowHandleFromSourceId(sourceId) {
  if (!sourceId?.startsWith("window:")) {
    return null;
  }
  const handlePart = sourceId.split(":")[1];
  if (!handlePart || !/^\d+$/.test(handlePart)) {
    return null;
  }
  return handlePart;
}
function getCursorSamplerCandidates() {
  const envPath = process.env.OPENSCREEN_CURSOR_SAMPLER_EXE?.trim();
  const archTag = process.arch === "arm64" ? "win32-arm64" : "win32-x64";
  const resolve = (...segs) => {
    const p = join(app.getAppPath(), ...segs);
    return app.isPackaged ? p.replace(/\.asar([/\\])/, ".asar.unpacked$1") : p;
  };
  const resolvePackaged = (...segs) => {
    return app.isPackaged ? join(process.resourcesPath, ...segs) : null;
  };
  return [
    envPath,
    resolve("electron", "native", "wgc-capture", "build", "cursor-sampler.exe"),
    resolve("electron", "native", "bin", archTag, "cursor-sampler.exe"),
    resolvePackaged("electron", "native", "bin", archTag, "cursor-sampler.exe")
  ].filter((c) => Boolean(c));
}
function findCursorSamplerPath() {
  for (const candidate of getCursorSamplerCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
const READY_TIMEOUT_MS = 5e3;
class WindowsNativeRecordingSession {
  constructor(options) {
    this.options = options;
  }
  options;
  assets = /* @__PURE__ */ new Map();
  samples = [];
  process = null;
  lineBuffer = "";
  startTimeMs = 0;
  readyResolve = null;
  readyReject = null;
  readyTimer = null;
  sampleCount = 0;
  outOfBoundsSampleCount = 0;
  previousLeftButtonDown = false;
  async start() {
    this.assets.clear();
    this.samples = [];
    this.lineBuffer = "";
    this.startTimeMs = this.options.startTimeMs ?? Date.now();
    this.sampleCount = 0;
    this.outOfBoundsSampleCount = 0;
    this.previousLeftButtonDown = false;
    const helperPath = findCursorSamplerPath();
    if (!helperPath) {
      throw new Error("Windows cursor sampler helper is not available.");
    }
    const windowHandle = parseWindowHandleFromSourceId(this.options.sourceId);
    const args = [String(this.options.sampleIntervalMs)];
    if (windowHandle) args.push(windowHandle);
    const child = spawn(helperPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    this.process = child;
    this.logDiagnostic("spawn", {
      pid: child.pid ?? null,
      sampleIntervalMs: this.options.sampleIntervalMs,
      sourceId: this.options.sourceId ?? null,
      windowHandle
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this.handleStdoutChunk(chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      const message = chunk.trim();
      if (message) {
        this.logDiagnostic("stderr", { message });
      }
      console.error("[cursor-native]", message);
    });
    child.once("exit", (code, signal) => {
      this.logDiagnostic("exit", {
        code,
        signal,
        sampleCount: this.sampleCount,
        assetCount: this.assets.size,
        outOfBoundsSampleCount: this.outOfBoundsSampleCount
      });
      this.rejectReady(
        new Error(`Windows cursor helper exited before ready (code=${code}, signal=${signal})`)
      );
    });
    child.once("error", (error) => {
      this.logDiagnostic("process-error", { message: error.message });
      this.rejectReady(error);
    });
    try {
      await this.waitUntilReady();
    } catch (error) {
      this.terminateHelperProcess();
      throw error;
    }
  }
  async stop() {
    const child = this.process;
    this.process = null;
    this.clearReadyState();
    this.killHelperProcess(child);
    this.logDiagnostic("stop", {
      sampleCount: this.sampleCount,
      assetCount: this.assets.size,
      outOfBoundsSampleCount: this.outOfBoundsSampleCount
    });
    return {
      version: 2,
      provider: this.assets.size > 0 ? "native" : "none",
      samples: this.samples,
      assets: [...this.assets.values()]
    };
  }
  handleStdoutChunk(chunk) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }
      try {
        const payload = JSON.parse(trimmedLine);
        this.handleEvent(payload);
      } catch (error) {
        console.error("Failed to parse Windows cursor helper output:", error, trimmedLine);
      }
    }
  }
  handleEvent(payload) {
    if (payload.type === "error") {
      this.logDiagnostic("helper-error", { message: payload.message });
      console.error("Windows cursor helper error:", payload.message);
      this.failHelper(new Error(payload.message));
      return;
    }
    if (payload.type === "ready") {
      this.logDiagnostic("ready", { timestampMs: payload.timestampMs });
      this.resolveReady();
      return;
    }
    if (payload.asset?.id && !this.assets.has(payload.asset.id)) {
      const assetDisplay = screen.getDisplayNearestPoint({ x: payload.x, y: payload.y });
      this.assets.set(payload.asset.id, {
        id: payload.asset.id,
        platform: "win32",
        imageDataUrl: payload.asset.imageDataUrl,
        width: payload.asset.width,
        height: payload.asset.height,
        hotspotX: payload.asset.hotspotX,
        hotspotY: payload.asset.hotspotY,
        scaleFactor: assetDisplay.scaleFactor,
        cursorType: payload.asset.cursorType ?? payload.cursorType ?? null
      });
      this.logDiagnostic("asset", {
        id: payload.asset.id,
        width: payload.asset.width,
        height: payload.asset.height,
        hotspotX: payload.asset.hotspotX,
        hotspotY: payload.asset.hotspotY,
        scaleFactor: assetDisplay.scaleFactor
      });
    }
    const normalized = this.normalizeSample(payload);
    this.sampleCount += 1;
    if (!normalized.withinBounds) {
      this.outOfBoundsSampleCount += 1;
    }
    this.samples.push(normalized.sample);
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }
  }
  normalizeSample(payload) {
    const bounds = payload.bounds ?? this.options.getDisplayBounds() ?? screen.getPrimaryDisplay().bounds;
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const normalizedX = (payload.x - bounds.x) / width;
    const normalizedY = (payload.y - bounds.y) / height;
    const withinBounds = normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1;
    const leftButtonDown = payload.leftButtonDown === true;
    const leftButtonPressed = payload.leftButtonPressed === true;
    const leftButtonReleased = payload.leftButtonReleased === true;
    const interactionType = leftButtonPressed || leftButtonDown && !this.previousLeftButtonDown ? "click" : leftButtonReleased || !leftButtonDown && this.previousLeftButtonDown ? "mouseup" : "move";
    this.previousLeftButtonDown = leftButtonDown;
    if (this.sampleCount === 0 || !withinBounds && this.outOfBoundsSampleCount === 0) {
      this.logDiagnostic("sample", {
        rawX: payload.x,
        rawY: payload.y,
        normalizedX,
        normalizedY,
        visible: payload.visible,
        withinBounds,
        bounds,
        handle: payload.handle
      });
    }
    return {
      withinBounds,
      sample: {
        timeMs: Math.max(0, payload.timestampMs - this.startTimeMs),
        cx: normalizedX,
        cy: normalizedY,
        assetId: payload.handle,
        visible: payload.visible && withinBounds,
        cursorType: payload.cursorType ?? payload.asset?.cursorType ?? null,
        interactionType
      }
    };
  }
  waitUntilReady() {
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      this.readyTimer = setTimeout(() => {
        this.rejectReady(new Error("Timed out waiting for Windows cursor helper readiness"));
      }, READY_TIMEOUT_MS);
    });
  }
  resolveReady() {
    const resolve = this.readyResolve;
    this.clearReadyState();
    resolve?.();
  }
  rejectReady(error) {
    const reject = this.readyReject;
    this.clearReadyState();
    reject?.(error);
  }
  failHelper(error) {
    this.rejectReady(error);
    this.terminateHelperProcess();
  }
  terminateHelperProcess() {
    const child = this.process;
    this.process = null;
    this.killHelperProcess(child);
  }
  killHelperProcess(child) {
    if (child && !child.killed) {
      child.kill();
    }
  }
  clearReadyState() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.readyResolve = null;
    this.readyReject = null;
  }
  logDiagnostic(event, data) {
    console.info(
      "[cursor-native][win32]",
      JSON.stringify({
        event,
        ...data
      })
    );
  }
}
function createCursorRecordingSession(options) {
  if (options.platform === "win32") {
    return new WindowsNativeRecordingSession({
      getDisplayBounds: options.getDisplayBounds,
      maxSamples: options.maxSamples,
      sampleIntervalMs: options.sampleIntervalMs,
      sourceId: options.sourceId,
      startTimeMs: options.startTimeMs
    });
  }
  if (options.platform === "darwin") {
    return new MacNativeCursorRecordingSession({
      getDisplayBounds: options.getDisplayBounds,
      maxSamples: options.maxSamples,
      sampleIntervalMs: options.sampleIntervalMs,
      startTimeMs: options.startTimeMs
    });
  }
  return new TelemetryRecordingSession({
    getDisplayBounds: options.getDisplayBounds,
    maxSamples: options.maxSamples,
    sampleIntervalMs: options.sampleIntervalMs,
    startTimeMs: options.startTimeMs
  });
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
var src$1 = {};
var tslib = { exports: {} };
var hasRequiredTslib;
function requireTslib() {
  if (hasRequiredTslib) return tslib.exports;
  hasRequiredTslib = 1;
  (function(module) {
    var __extends;
    var __assign;
    var __rest;
    var __decorate;
    var __param;
    var __esDecorate;
    var __runInitializers;
    var __propKey;
    var __setFunctionName;
    var __metadata;
    var __awaiter;
    var __generator;
    var __exportStar;
    var __values;
    var __read;
    var __spread;
    var __spreadArrays;
    var __spreadArray;
    var __await;
    var __asyncGenerator;
    var __asyncDelegator;
    var __asyncValues;
    var __makeTemplateObject;
    var __importStar;
    var __importDefault;
    var __classPrivateFieldGet;
    var __classPrivateFieldSet;
    var __classPrivateFieldIn;
    var __createBinding;
    var __addDisposableResource;
    var __disposeResources;
    var __rewriteRelativeImportExtension;
    (function(factory) {
      var root = typeof commonjsGlobal === "object" ? commonjsGlobal : typeof self === "object" ? self : typeof this === "object" ? this : {};
      {
        factory(createExporter(root, createExporter(module.exports)));
      }
      function createExporter(exports, previous) {
        if (exports !== root) {
          if (typeof Object.create === "function") {
            Object.defineProperty(exports, "__esModule", { value: true });
          } else {
            exports.__esModule = true;
          }
        }
        return function(id, v) {
          return exports[id] = previous ? previous(id, v) : v;
        };
      }
    })(function(exporter) {
      var extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
        d.__proto__ = b;
      } || function(d, b) {
        for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
      };
      __extends = function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      __rest = function(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
          t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
          for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
              t[p[i]] = s[p[i]];
          }
        return t;
      };
      __decorate = function(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
      };
      __param = function(paramIndex, decorator) {
        return function(target, key) {
          decorator(target, key, paramIndex);
        };
      };
      __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
        function accept(f) {
          if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
          return f;
        }
        var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
        var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
        var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
        var _, done = false;
        for (var i = decorators.length - 1; i >= 0; i--) {
          var context = {};
          for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
          for (var p in contextIn.access) context.access[p] = contextIn.access[p];
          context.addInitializer = function(f) {
            if (done) throw new TypeError("Cannot add initializers after decoration has completed");
            extraInitializers.push(accept(f || null));
          };
          var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
          if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
          } else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
          }
        }
        if (target) Object.defineProperty(target, contextIn.name, descriptor);
        done = true;
      };
      __runInitializers = function(thisArg, initializers, value) {
        var useValue = arguments.length > 2;
        for (var i = 0; i < initializers.length; i++) {
          value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
        }
        return useValue ? value : void 0;
      };
      __propKey = function(x) {
        return typeof x === "symbol" ? x : "".concat(x);
      };
      __setFunctionName = function(f, name, prefix) {
        if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
        return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
      };
      __metadata = function(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
      };
      __awaiter = function(thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
          });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      __generator = function(thisArg, body) {
        var _ = { label: 0, sent: function() {
          if (t[0] & 1) throw t[1];
          return t[1];
        }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
        return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
          return this;
        }), g;
        function verb(n) {
          return function(v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError("Generator is already executing.");
          while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
              case 0:
              case 1:
                t = op;
                break;
              case 4:
                _.label++;
                return { value: op[1], done: false };
              case 5:
                _.label++;
                y = op[1];
                op = [0];
                continue;
              case 7:
                op = _.ops.pop();
                _.trys.pop();
                continue;
              default:
                if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                  _ = 0;
                  continue;
                }
                if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                  _.label = op[1];
                  break;
                }
                if (op[0] === 6 && _.label < t[1]) {
                  _.label = t[1];
                  t = op;
                  break;
                }
                if (t && _.label < t[2]) {
                  _.label = t[2];
                  _.ops.push(op);
                  break;
                }
                if (t[2]) _.ops.pop();
                _.trys.pop();
                continue;
            }
            op = body.call(thisArg, _);
          } catch (e) {
            op = [6, e];
            y = 0;
          } finally {
            f = t = 0;
          }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
      __exportStar = function(m, o) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
      };
      __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      });
      __values = function(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
          next: function() {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
          }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
      };
      __read = function(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
          while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        } catch (error) {
          e = { error };
        } finally {
          try {
            if (r && !r.done && (m = i["return"])) m.call(i);
          } finally {
            if (e) throw e.error;
          }
        }
        return ar;
      };
      __spread = function() {
        for (var ar = [], i = 0; i < arguments.length; i++)
          ar = ar.concat(__read(arguments[i]));
        return ar;
      };
      __spreadArrays = function() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
          for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
        return r;
      };
      __spreadArray = function(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
          if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
          }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
      };
      __await = function(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
      };
      __asyncGenerator = function(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
          return this;
        }, i;
        function awaitReturn(f) {
          return function(v) {
            return Promise.resolve(v).then(f, reject);
          };
        }
        function verb(n, f) {
          if (g[n]) {
            i[n] = function(v) {
              return new Promise(function(a, b) {
                q.push([n, v, a, b]) > 1 || resume(n, v);
              });
            };
            if (f) i[n] = f(i[n]);
          }
        }
        function resume(n, v) {
          try {
            step(g[n](v));
          } catch (e) {
            settle(q[0][3], e);
          }
        }
        function step(r) {
          r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
        }
        function fulfill(value) {
          resume("next", value);
        }
        function reject(value) {
          resume("throw", value);
        }
        function settle(f, v) {
          if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
        }
      };
      __asyncDelegator = function(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function(e) {
          throw e;
        }), verb("return"), i[Symbol.iterator] = function() {
          return this;
        }, i;
        function verb(n, f) {
          i[n] = o[n] ? function(v) {
            return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
          } : f;
        }
      };
      __asyncValues = function(o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
          return this;
        }, i);
        function verb(n) {
          i[n] = o[n] && function(v) {
            return new Promise(function(resolve, reject) {
              v = o[n](v), settle(resolve, reject, v.done, v.value);
            });
          };
        }
        function settle(resolve, reject, d, v) {
          Promise.resolve(v).then(function(v2) {
            resolve({ value: v2, done: d });
          }, reject);
        }
      };
      __makeTemplateObject = function(cooked, raw) {
        if (Object.defineProperty) {
          Object.defineProperty(cooked, "raw", { value: raw });
        } else {
          cooked.raw = raw;
        }
        return cooked;
      };
      var __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      };
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      __importStar = function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      __importDefault = function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      __classPrivateFieldGet = function(receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
      };
      __classPrivateFieldSet = function(receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
      };
      __classPrivateFieldIn = function(state, receiver) {
        if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
        return typeof state === "function" ? receiver === state : state.has(receiver);
      };
      __addDisposableResource = function(env, value, async) {
        if (value !== null && value !== void 0) {
          if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
          var dispose, inner;
          if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
          }
          if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
          }
          if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
          if (inner) dispose = function() {
            try {
              inner.call(this);
            } catch (e) {
              return Promise.reject(e);
            }
          };
          env.stack.push({ value, dispose, async });
        } else if (async) {
          env.stack.push({ async: true });
        }
        return value;
      };
      var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      __disposeResources = function(env) {
        function fail(e) {
          env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
          env.hasError = true;
        }
        var r, s = 0;
        function next() {
          while (r = env.stack.pop()) {
            try {
              if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
              if (r.dispose) {
                var result = r.dispose.call(r.value);
                if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
                  fail(e);
                  return next();
                });
              } else s |= 1;
            } catch (e) {
              fail(e);
            }
          }
          if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
          if (env.hasError) throw env.error;
        }
        return next();
      };
      __rewriteRelativeImportExtension = function(path2, preserveJsx) {
        if (typeof path2 === "string" && /^\.\.?\//.test(path2)) {
          return path2.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
          });
        }
        return path2;
      };
      exporter("__extends", __extends);
      exporter("__assign", __assign);
      exporter("__rest", __rest);
      exporter("__decorate", __decorate);
      exporter("__param", __param);
      exporter("__esDecorate", __esDecorate);
      exporter("__runInitializers", __runInitializers);
      exporter("__propKey", __propKey);
      exporter("__setFunctionName", __setFunctionName);
      exporter("__metadata", __metadata);
      exporter("__awaiter", __awaiter);
      exporter("__generator", __generator);
      exporter("__exportStar", __exportStar);
      exporter("__createBinding", __createBinding);
      exporter("__values", __values);
      exporter("__read", __read);
      exporter("__spread", __spread);
      exporter("__spreadArrays", __spreadArrays);
      exporter("__spreadArray", __spreadArray);
      exporter("__await", __await);
      exporter("__asyncGenerator", __asyncGenerator);
      exporter("__asyncDelegator", __asyncDelegator);
      exporter("__asyncValues", __asyncValues);
      exporter("__makeTemplateObject", __makeTemplateObject);
      exporter("__importStar", __importStar);
      exporter("__importDefault", __importDefault);
      exporter("__classPrivateFieldGet", __classPrivateFieldGet);
      exporter("__classPrivateFieldSet", __classPrivateFieldSet);
      exporter("__classPrivateFieldIn", __classPrivateFieldIn);
      exporter("__addDisposableResource", __addDisposableResource);
      exporter("__disposeResources", __disposeResources);
      exporter("__rewriteRelativeImportExtension", __rewriteRelativeImportExtension);
    });
  })(tslib);
  return tslib.exports;
}
var fixWebmDuration = {};
var src = {};
var WebmBase = {};
var hasRequiredWebmBase;
function requireWebmBase() {
  if (hasRequiredWebmBase) return WebmBase;
  hasRequiredWebmBase = 1;
  Object.defineProperty(WebmBase, "__esModule", { value: true });
  WebmBase.WebmBase = void 0;
  let WebmBase$1 = class WebmBase {
    constructor(name = "Unknown", start = 0) {
      this.name = name;
      this.start = start;
    }
    getType() {
      return "Unknown";
    }
    updateBySource() {
    }
    setSource(source) {
      this.source = source;
      this.updateBySource();
    }
    updateByData() {
    }
    setData(data) {
      this.data = data;
      this.updateByData();
    }
    getValue() {
      return this.data;
    }
    setValue(value) {
      this.setData(value);
    }
  };
  WebmBase.WebmBase = WebmBase$1;
  return WebmBase;
}
var WebmContainer = {};
var sections = {};
var SectionType = {};
var hasRequiredSectionType;
function requireSectionType() {
  if (hasRequiredSectionType) return SectionType;
  hasRequiredSectionType = 1;
  Object.defineProperty(SectionType, "__esModule", { value: true });
  SectionType.SectionType = void 0;
  var SectionType$1;
  (function(SectionType2) {
    SectionType2["Container"] = "Container";
    SectionType2["Uint"] = "Uint";
    SectionType2["Int"] = "Int";
    SectionType2["Float"] = "Float";
    SectionType2["String"] = "String";
    SectionType2["Date"] = "Date";
    SectionType2["Binary"] = "Binary";
  })(SectionType$1 || (SectionType.SectionType = SectionType$1 = {}));
  return SectionType;
}
var hasRequiredSections;
function requireSections() {
  if (hasRequiredSections) return sections;
  hasRequiredSections = 1;
  Object.defineProperty(sections, "__esModule", { value: true });
  sections.sections = void 0;
  const SectionType_1 = requireSectionType();
  sections.sections = {
    172351395: { name: "EBML", type: SectionType_1.SectionType.Container },
    646: { name: "EBMLVersion", type: SectionType_1.SectionType.Uint },
    759: { name: "EBMLReadVersion", type: SectionType_1.SectionType.Uint },
    754: { name: "EBMLMaxIDLength", type: SectionType_1.SectionType.Uint },
    755: { name: "EBMLMaxSizeLength", type: SectionType_1.SectionType.Uint },
    642: { name: "DocType", type: SectionType_1.SectionType.String },
    647: { name: "DocTypeVersion", type: SectionType_1.SectionType.Uint },
    645: { name: "DocTypeReadVersion", type: SectionType_1.SectionType.Uint },
    108: { name: "Void", type: SectionType_1.SectionType.Binary },
    63: { name: "CRC-32", type: SectionType_1.SectionType.Binary },
    190023271: { name: "SignatureSlot", type: SectionType_1.SectionType.Container },
    16010: { name: "SignatureAlgo", type: SectionType_1.SectionType.Uint },
    16026: { name: "SignatureHash", type: SectionType_1.SectionType.Uint },
    16037: { name: "SignaturePublicKey", type: SectionType_1.SectionType.Binary },
    16053: { name: "Signature", type: SectionType_1.SectionType.Binary },
    15963: { name: "SignatureElements", type: SectionType_1.SectionType.Container },
    15995: { name: "SignatureElementList", type: SectionType_1.SectionType.Container },
    9522: { name: "SignedElement", type: SectionType_1.SectionType.Binary },
    139690087: { name: "Segment", type: SectionType_1.SectionType.Container },
    21863284: { name: "SeekHead", type: SectionType_1.SectionType.Container },
    3515: { name: "Seek", type: SectionType_1.SectionType.Container },
    5035: { name: "SeekID", type: SectionType_1.SectionType.Binary },
    5036: { name: "SeekPosition", type: SectionType_1.SectionType.Uint },
    88713574: { name: "Info", type: SectionType_1.SectionType.Container },
    13220: { name: "SegmentUID", type: SectionType_1.SectionType.Binary },
    13188: { name: "SegmentFilename", type: SectionType_1.SectionType.String },
    1882403: { name: "PrevUID", type: SectionType_1.SectionType.Binary },
    1868715: { name: "PrevFilename", type: SectionType_1.SectionType.String },
    2013475: { name: "NextUID", type: SectionType_1.SectionType.Binary },
    1999803: { name: "NextFilename", type: SectionType_1.SectionType.String },
    1092: { name: "SegmentFamily", type: SectionType_1.SectionType.Binary },
    10532: { name: "ChapterTranslate", type: SectionType_1.SectionType.Container },
    10748: { name: "ChapterTranslateEditionUID", type: SectionType_1.SectionType.Uint },
    10687: { name: "ChapterTranslateCodec", type: SectionType_1.SectionType.Uint },
    10661: { name: "ChapterTranslateID", type: SectionType_1.SectionType.Binary },
    710577: { name: "TimecodeScale", type: SectionType_1.SectionType.Uint },
    1161: { name: "Duration", type: SectionType_1.SectionType.Float },
    1121: { name: "DateUTC", type: SectionType_1.SectionType.Date },
    15273: { name: "Title", type: SectionType_1.SectionType.String },
    3456: { name: "MuxingApp", type: SectionType_1.SectionType.String },
    5953: { name: "WritingApp", type: SectionType_1.SectionType.String },
    // Intentionally don't recognize the Cluster section because it's large
    // 0xf43b675: { name: "Cluster", type: SectionType.Container },
    103: { name: "Timecode", type: SectionType_1.SectionType.Uint },
    6228: { name: "SilentTracks", type: SectionType_1.SectionType.Container },
    6359: { name: "SilentTrackNumber", type: SectionType_1.SectionType.Uint },
    39: { name: "Position", type: SectionType_1.SectionType.Uint },
    43: { name: "PrevSize", type: SectionType_1.SectionType.Uint },
    35: { name: "SimpleBlock", type: SectionType_1.SectionType.Binary },
    32: { name: "BlockGroup", type: SectionType_1.SectionType.Container },
    33: { name: "Block", type: SectionType_1.SectionType.Binary },
    34: { name: "BlockVirtual", type: SectionType_1.SectionType.Binary },
    13729: { name: "BlockAdditions", type: SectionType_1.SectionType.Container },
    38: { name: "BlockMore", type: SectionType_1.SectionType.Container },
    110: { name: "BlockAddID", type: SectionType_1.SectionType.Uint },
    37: { name: "BlockAdditional", type: SectionType_1.SectionType.Binary },
    27: { name: "BlockDuration", type: SectionType_1.SectionType.Uint },
    122: { name: "ReferencePriority", type: SectionType_1.SectionType.Uint },
    123: { name: "ReferenceBlock", type: SectionType_1.SectionType.Int },
    125: { name: "ReferenceVirtual", type: SectionType_1.SectionType.Int },
    36: { name: "CodecState", type: SectionType_1.SectionType.Binary },
    13730: { name: "DiscardPadding", type: SectionType_1.SectionType.Int },
    14: { name: "Slices", type: SectionType_1.SectionType.Container },
    104: { name: "TimeSlice", type: SectionType_1.SectionType.Container },
    76: { name: "LaceNumber", type: SectionType_1.SectionType.Uint },
    77: { name: "FrameNumber", type: SectionType_1.SectionType.Uint },
    75: { name: "BlockAdditionID", type: SectionType_1.SectionType.Uint },
    78: { name: "Delay", type: SectionType_1.SectionType.Uint },
    79: { name: "SliceDuration", type: SectionType_1.SectionType.Uint },
    72: { name: "ReferenceFrame", type: SectionType_1.SectionType.Container },
    73: { name: "ReferenceOffset", type: SectionType_1.SectionType.Uint },
    74: { name: "ReferenceTimeCode", type: SectionType_1.SectionType.Uint },
    47: { name: "EncryptedBlock", type: SectionType_1.SectionType.Binary },
    106212971: { name: "Tracks", type: SectionType_1.SectionType.Container },
    46: { name: "TrackEntry", type: SectionType_1.SectionType.Container },
    87: { name: "TrackNumber", type: SectionType_1.SectionType.Uint },
    13253: { name: "TrackUID", type: SectionType_1.SectionType.Uint },
    3: { name: "TrackType", type: SectionType_1.SectionType.Uint },
    57: { name: "FlagEnabled", type: SectionType_1.SectionType.Uint },
    8: { name: "FlagDefault", type: SectionType_1.SectionType.Uint },
    5546: { name: "FlagForced", type: SectionType_1.SectionType.Uint },
    28: { name: "FlagLacing", type: SectionType_1.SectionType.Uint },
    11751: { name: "MinCache", type: SectionType_1.SectionType.Uint },
    11768: { name: "MaxCache", type: SectionType_1.SectionType.Uint },
    254851: { name: "DefaultDuration", type: SectionType_1.SectionType.Uint },
    216698: { name: "DefaultDecodedFieldDuration", type: SectionType_1.SectionType.Uint },
    209231: { name: "TrackTimecodeScale", type: SectionType_1.SectionType.Float },
    4991: { name: "TrackOffset", type: SectionType_1.SectionType.Int },
    5614: { name: "MaxBlockAdditionID", type: SectionType_1.SectionType.Uint },
    4974: { name: "Name", type: SectionType_1.SectionType.String },
    177564: { name: "Language", type: SectionType_1.SectionType.String },
    6: { name: "CodecID", type: SectionType_1.SectionType.String },
    9122: { name: "CodecPrivate", type: SectionType_1.SectionType.Binary },
    362120: { name: "CodecName", type: SectionType_1.SectionType.String },
    13382: { name: "AttachmentLink", type: SectionType_1.SectionType.Uint },
    1742487: { name: "CodecSettings", type: SectionType_1.SectionType.String },
    1785920: { name: "CodecInfoURL", type: SectionType_1.SectionType.String },
    438848: { name: "CodecDownloadURL", type: SectionType_1.SectionType.String },
    42: { name: "CodecDecodeAll", type: SectionType_1.SectionType.Uint },
    12203: { name: "TrackOverlay", type: SectionType_1.SectionType.Uint },
    5802: { name: "CodecDelay", type: SectionType_1.SectionType.Uint },
    5819: { name: "SeekPreRoll", type: SectionType_1.SectionType.Uint },
    9764: { name: "TrackTranslate", type: SectionType_1.SectionType.Container },
    9980: { name: "TrackTranslateEditionUID", type: SectionType_1.SectionType.Uint },
    9919: { name: "TrackTranslateCodec", type: SectionType_1.SectionType.Uint },
    9893: { name: "TrackTranslateTrackID", type: SectionType_1.SectionType.Binary },
    96: { name: "Video", type: SectionType_1.SectionType.Container },
    26: { name: "FlagInterlaced", type: SectionType_1.SectionType.Uint },
    5048: { name: "StereoMode", type: SectionType_1.SectionType.Uint },
    5056: { name: "AlphaMode", type: SectionType_1.SectionType.Uint },
    5049: { name: "OldStereoMode", type: SectionType_1.SectionType.Uint },
    48: { name: "PixelWidth", type: SectionType_1.SectionType.Uint },
    58: { name: "PixelHeight", type: SectionType_1.SectionType.Uint },
    5290: { name: "PixelCropBottom", type: SectionType_1.SectionType.Uint },
    5307: { name: "PixelCropTop", type: SectionType_1.SectionType.Uint },
    5324: { name: "PixelCropLeft", type: SectionType_1.SectionType.Uint },
    5341: { name: "PixelCropRight", type: SectionType_1.SectionType.Uint },
    5296: { name: "DisplayWidth", type: SectionType_1.SectionType.Uint },
    5306: { name: "DisplayHeight", type: SectionType_1.SectionType.Uint },
    5298: { name: "DisplayUnit", type: SectionType_1.SectionType.Uint },
    5299: { name: "AspectRatioType", type: SectionType_1.SectionType.Uint },
    963876: { name: "ColourSpace", type: SectionType_1.SectionType.Binary },
    1029411: { name: "GammaValue", type: SectionType_1.SectionType.Float },
    230371: { name: "FrameRate", type: SectionType_1.SectionType.Float },
    97: { name: "Audio", type: SectionType_1.SectionType.Container },
    53: { name: "SamplingFrequency", type: SectionType_1.SectionType.Float },
    14517: { name: "OutputSamplingFrequency", type: SectionType_1.SectionType.Float },
    31: { name: "Channels", type: SectionType_1.SectionType.Uint },
    15739: { name: "ChannelPositions", type: SectionType_1.SectionType.Binary },
    8804: { name: "BitDepth", type: SectionType_1.SectionType.Uint },
    98: { name: "TrackOperation", type: SectionType_1.SectionType.Container },
    99: { name: "TrackCombinePlanes", type: SectionType_1.SectionType.Container },
    100: { name: "TrackPlane", type: SectionType_1.SectionType.Container },
    101: { name: "TrackPlaneUID", type: SectionType_1.SectionType.Uint },
    102: { name: "TrackPlaneType", type: SectionType_1.SectionType.Uint },
    105: { name: "TrackJoinBlocks", type: SectionType_1.SectionType.Container },
    109: { name: "TrackJoinUID", type: SectionType_1.SectionType.Uint },
    64: { name: "TrickTrackUID", type: SectionType_1.SectionType.Uint },
    65: { name: "TrickTrackSegmentUID", type: SectionType_1.SectionType.Binary },
    70: { name: "TrickTrackFlag", type: SectionType_1.SectionType.Uint },
    71: { name: "TrickMasterTrackUID", type: SectionType_1.SectionType.Uint },
    68: { name: "TrickMasterTrackSegmentUID", type: SectionType_1.SectionType.Binary },
    11648: { name: "ContentEncodings", type: SectionType_1.SectionType.Container },
    8768: { name: "ContentEncoding", type: SectionType_1.SectionType.Container },
    4145: { name: "ContentEncodingOrder", type: SectionType_1.SectionType.Uint },
    4146: { name: "ContentEncodingScope", type: SectionType_1.SectionType.Uint },
    4147: { name: "ContentEncodingType", type: SectionType_1.SectionType.Uint },
    4148: { name: "ContentCompression", type: SectionType_1.SectionType.Container },
    596: { name: "ContentCompAlgo", type: SectionType_1.SectionType.Uint },
    597: { name: "ContentCompSettings", type: SectionType_1.SectionType.Binary },
    4149: { name: "ContentEncryption", type: SectionType_1.SectionType.Container },
    2017: { name: "ContentEncAlgo", type: SectionType_1.SectionType.Uint },
    2018: { name: "ContentEncKeyID", type: SectionType_1.SectionType.Binary },
    2019: { name: "ContentSignature", type: SectionType_1.SectionType.Binary },
    2020: { name: "ContentSigKeyID", type: SectionType_1.SectionType.Binary },
    2021: { name: "ContentSigAlgo", type: SectionType_1.SectionType.Uint },
    2022: { name: "ContentSigHashAlgo", type: SectionType_1.SectionType.Uint },
    206814059: { name: "Cues", type: SectionType_1.SectionType.Container },
    59: { name: "CuePoint", type: SectionType_1.SectionType.Container },
    51: { name: "CueTime", type: SectionType_1.SectionType.Uint },
    55: { name: "CueTrackPositions", type: SectionType_1.SectionType.Container },
    119: { name: "CueTrack", type: SectionType_1.SectionType.Uint },
    113: { name: "CueClusterPosition", type: SectionType_1.SectionType.Uint },
    112: { name: "CueRelativePosition", type: SectionType_1.SectionType.Uint },
    50: { name: "CueDuration", type: SectionType_1.SectionType.Uint },
    4984: { name: "CueBlockNumber", type: SectionType_1.SectionType.Uint },
    106: { name: "CueCodecState", type: SectionType_1.SectionType.Uint },
    91: { name: "CueReference", type: SectionType_1.SectionType.Container },
    22: { name: "CueRefTime", type: SectionType_1.SectionType.Uint },
    23: { name: "CueRefCluster", type: SectionType_1.SectionType.Uint },
    4959: { name: "CueRefNumber", type: SectionType_1.SectionType.Uint },
    107: { name: "CueRefCodecState", type: SectionType_1.SectionType.Uint },
    155296873: { name: "Attachments", type: SectionType_1.SectionType.Container },
    8615: { name: "AttachedFile", type: SectionType_1.SectionType.Container },
    1662: { name: "FileDescription", type: SectionType_1.SectionType.String },
    1646: { name: "FileName", type: SectionType_1.SectionType.String },
    1632: { name: "FileMimeType", type: SectionType_1.SectionType.String },
    1628: { name: "FileData", type: SectionType_1.SectionType.Binary },
    1710: { name: "FileUID", type: SectionType_1.SectionType.Uint },
    1653: { name: "FileReferral", type: SectionType_1.SectionType.Binary },
    1633: { name: "FileUsedStartTime", type: SectionType_1.SectionType.Uint },
    1634: { name: "FileUsedEndTime", type: SectionType_1.SectionType.Uint },
    4433776: { name: "Chapters", type: SectionType_1.SectionType.Container },
    1465: { name: "EditionEntry", type: SectionType_1.SectionType.Container },
    1468: { name: "EditionUID", type: SectionType_1.SectionType.Uint },
    1469: { name: "EditionFlagHidden", type: SectionType_1.SectionType.Uint },
    1499: { name: "EditionFlagDefault", type: SectionType_1.SectionType.Uint },
    1501: { name: "EditionFlagOrdered", type: SectionType_1.SectionType.Uint },
    54: { name: "ChapterAtom", type: SectionType_1.SectionType.Container },
    13252: { name: "ChapterUID", type: SectionType_1.SectionType.Uint },
    5716: { name: "ChapterStringUID", type: SectionType_1.SectionType.String },
    17: { name: "ChapterTimeStart", type: SectionType_1.SectionType.Uint },
    18: { name: "ChapterTimeEnd", type: SectionType_1.SectionType.Uint },
    24: { name: "ChapterFlagHidden", type: SectionType_1.SectionType.Uint },
    1432: { name: "ChapterFlagEnabled", type: SectionType_1.SectionType.Uint },
    11879: { name: "ChapterSegmentUID", type: SectionType_1.SectionType.Binary },
    11964: { name: "ChapterSegmentEditionUID", type: SectionType_1.SectionType.Uint },
    9155: { name: "ChapterPhysicalEquiv", type: SectionType_1.SectionType.Uint },
    15: { name: "ChapterTrack", type: SectionType_1.SectionType.Container },
    9: { name: "ChapterTrackNumber", type: SectionType_1.SectionType.Uint },
    0: { name: "ChapterDisplay", type: SectionType_1.SectionType.Container },
    5: { name: "ChapString", type: SectionType_1.SectionType.String },
    892: { name: "ChapLanguage", type: SectionType_1.SectionType.String },
    894: { name: "ChapCountry", type: SectionType_1.SectionType.String },
    10564: { name: "ChapProcess", type: SectionType_1.SectionType.Container },
    10581: { name: "ChapProcessCodecID", type: SectionType_1.SectionType.Uint },
    1293: { name: "ChapProcessPrivate", type: SectionType_1.SectionType.Binary },
    10513: { name: "ChapProcessCommand", type: SectionType_1.SectionType.Container },
    10530: { name: "ChapProcessTime", type: SectionType_1.SectionType.Uint },
    10547: { name: "ChapProcessData", type: SectionType_1.SectionType.Binary },
    39109479: { name: "Tags", type: SectionType_1.SectionType.Container },
    13171: { name: "Tag", type: SectionType_1.SectionType.Container },
    9152: { name: "Targets", type: SectionType_1.SectionType.Container },
    10442: { name: "TargetTypeValue", type: SectionType_1.SectionType.Uint },
    9162: { name: "TargetType", type: SectionType_1.SectionType.String },
    9157: { name: "TagTrackUID", type: SectionType_1.SectionType.Uint },
    9161: { name: "TagEditionUID", type: SectionType_1.SectionType.Uint },
    9156: { name: "TagChapterUID", type: SectionType_1.SectionType.Uint },
    9158: { name: "TagAttachmentUID", type: SectionType_1.SectionType.Uint },
    10184: { name: "SimpleTag", type: SectionType_1.SectionType.Container },
    1443: { name: "TagName", type: SectionType_1.SectionType.String },
    1146: { name: "TagLanguage", type: SectionType_1.SectionType.String },
    1156: { name: "TagDefault", type: SectionType_1.SectionType.Uint },
    1159: { name: "TagString", type: SectionType_1.SectionType.String },
    1157: { name: "TagBinary", type: SectionType_1.SectionType.Binary },
    5552: { name: "Colour", type: SectionType_1.SectionType.Container },
    5553: { name: "MatrixCoefficients", type: SectionType_1.SectionType.Uint },
    5554: { name: "BitsPerChannel", type: SectionType_1.SectionType.Uint },
    5555: { name: "ChromaSubsamplingHorz", type: SectionType_1.SectionType.Uint },
    5556: { name: "ChromaSubsamplingVert", type: SectionType_1.SectionType.Uint },
    5557: { name: "CbSubsamplingHorz", type: SectionType_1.SectionType.Uint },
    5558: { name: "CbSubsamplingVert", type: SectionType_1.SectionType.Uint },
    5559: { name: "ChromaSitingHorz", type: SectionType_1.SectionType.Uint },
    5560: { name: "ChromaSitingVert", type: SectionType_1.SectionType.Uint },
    5561: { name: "Range", type: SectionType_1.SectionType.Uint },
    5562: { name: "TransferCharacteristics", type: SectionType_1.SectionType.Uint },
    5563: { name: "Primaries", type: SectionType_1.SectionType.Uint },
    5564: { name: "MaxCLL", type: SectionType_1.SectionType.Uint },
    5565: { name: "MaxFALL", type: SectionType_1.SectionType.Uint }
  };
  return sections;
}
var WebmUint = {};
var hasRequiredWebmUint;
function requireWebmUint() {
  if (hasRequiredWebmUint) return WebmUint;
  hasRequiredWebmUint = 1;
  Object.defineProperty(WebmUint, "__esModule", { value: true });
  WebmUint.WebmUint = void 0;
  const WebmBase_1 = requireWebmBase();
  function padHex(hex) {
    return hex.length % 2 === 1 ? "0" + hex : hex;
  }
  let WebmUint$1 = class WebmUint extends WebmBase_1.WebmBase {
    constructor(name, start = 0) {
      super(name, start);
    }
    getType() {
      return "Uint";
    }
    updateBySource() {
      this.data = "";
      for (let i = 0; i < this.source.length; i++) {
        const hex = this.source[i].toString(16);
        this.data += padHex(hex);
      }
    }
    updateByData() {
      const length = this.data.length / 2;
      this.source = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        const hex = this.data.substring(i * 2, i * 2 + 2);
        this.source[i] = parseInt(hex, 16);
      }
    }
    getValue() {
      return parseInt(this.data, 16);
    }
    setValue(value) {
      this.setData(padHex(value.toString(16)));
    }
  };
  WebmUint.WebmUint = WebmUint$1;
  return WebmUint;
}
var WebmFloat = {};
var hasRequiredWebmFloat;
function requireWebmFloat() {
  if (hasRequiredWebmFloat) return WebmFloat;
  hasRequiredWebmFloat = 1;
  Object.defineProperty(WebmFloat, "__esModule", { value: true });
  WebmFloat.WebmFloat = void 0;
  const WebmBase_1 = requireWebmBase();
  let WebmFloat$1 = class WebmFloat extends WebmBase_1.WebmBase {
    constructor(name, start = 0) {
      super(name, start);
    }
    getType() {
      return "Float";
    }
    getFloatArrayType() {
      return this.source && this.source.length === 4 ? Float32Array : Float64Array;
    }
    updateBySource() {
      const byteArray = this.source.reverse();
      const floatArrayType = this.getFloatArrayType();
      const floatArray = new floatArrayType(byteArray.buffer);
      this.data = floatArray[0];
    }
    updateByData() {
      const floatArrayType = this.getFloatArrayType();
      const floatArray = new floatArrayType([this.data]);
      const byteArray = new Uint8Array(floatArray.buffer);
      this.source = byteArray.reverse();
    }
  };
  WebmFloat.WebmFloat = WebmFloat$1;
  return WebmFloat;
}
var WebmString = {};
var hasRequiredWebmString;
function requireWebmString() {
  if (hasRequiredWebmString) return WebmString;
  hasRequiredWebmString = 1;
  Object.defineProperty(WebmString, "__esModule", { value: true });
  WebmString.WebmString = void 0;
  const WebmBase_1 = requireWebmBase();
  let WebmString$1 = class WebmString extends WebmBase_1.WebmBase {
    constructor(name, start = 0) {
      super(name, start);
    }
    getType() {
      return "String";
    }
    updateBySource() {
      this.data = this.source;
    }
    updateByData() {
      this.source = this.data;
    }
    getValue() {
      let result = "";
      this.source.forEach((code) => {
        result += String.fromCharCode(code);
      });
      return result;
    }
  };
  WebmString.WebmString = WebmString$1;
  return WebmString;
}
var hasRequiredWebmContainer;
function requireWebmContainer() {
  if (hasRequiredWebmContainer) return WebmContainer;
  hasRequiredWebmContainer = 1;
  Object.defineProperty(WebmContainer, "__esModule", { value: true });
  WebmContainer.WebmContainer = void 0;
  const WebmBase_1 = requireWebmBase();
  const sections_1 = requireSections();
  const SectionType_1 = requireSectionType();
  const WebmUint_1 = requireWebmUint();
  const WebmFloat_1 = requireWebmFloat();
  const WebmString_1 = requireWebmString();
  let WebmContainer$1 = class WebmContainer2 extends WebmBase_1.WebmBase {
    constructor(name, isInfinite = false, start = 0) {
      super(name, start);
      this.isInfinite = isInfinite;
      this.offset = 0;
    }
    getType() {
      return "Container";
    }
    readByte() {
      return this.source[this.offset++];
    }
    readUint() {
      const firstByte = this.readByte();
      const bytes = 8 - firstByte.toString(2).length;
      let value = firstByte - (1 << 7 - bytes);
      for (let i = 0; i < bytes; i++) {
        value <<= 8;
        value |= this.readByte();
      }
      return value;
    }
    updateBySource() {
      var _a;
      this.data = [];
      let end;
      for (this.offset = 0; this.offset < this.source.length; this.offset = end) {
        const start = this.offset;
        const id = this.readUint();
        const { name, type } = (_a = sections_1.sections[id]) !== null && _a !== void 0 ? _a : {};
        const len = this.readUint();
        end = this.source.length;
        if (len >= 0)
          end = Math.min(this.offset + len, end);
        const data = this.source.slice(this.offset, end);
        let section;
        switch (type) {
          case SectionType_1.SectionType.Container:
            section = new WebmContainer2(name, len < 0, start);
            break;
          case SectionType_1.SectionType.Uint:
            section = new WebmUint_1.WebmUint(name, start);
            break;
          case SectionType_1.SectionType.Float:
            section = new WebmFloat_1.WebmFloat(name, start);
            break;
          case SectionType_1.SectionType.String:
            section = new WebmString_1.WebmString(name, start);
            break;
          default:
            section = new WebmBase_1.WebmBase(name, start);
            break;
        }
        section.setSource(data);
        this.data.push({
          id,
          idHex: id.toString(16),
          data: section
        });
      }
    }
    writeUint(x, draft = false) {
      let bytes;
      for (bytes = 1; (x < 0 || x >= 1 << 7 * bytes) && bytes < 8; bytes++) {
      }
      if (!draft) {
        for (let i = 0; i < bytes; i++) {
          this.source[this.offset + i] = x >> 8 * (bytes - 1 - i) & 255;
        }
        this.source[this.offset] &= (1 << 8 - bytes) - 1;
        this.source[this.offset] |= 1 << 8 - bytes;
      }
      this.offset += bytes;
    }
    writeSections(draft = false) {
      this.offset = 0;
      for (let i = 0; i < this.data.length; i++) {
        const section = this.data[i], content = section.data.source, contentLength = content.length;
        this.writeUint(section.id, draft);
        this.writeUint(section.data instanceof WebmContainer2 && section.data.isInfinite ? -1 : contentLength, draft);
        if (!draft) {
          this.source.set(content, this.offset);
        }
        this.offset += contentLength;
      }
      return this.offset;
    }
    updateByData() {
      const length = this.writeSections(true);
      this.source = new Uint8Array(length);
      this.writeSections();
    }
    getSectionById(id) {
      for (let i = 0; i < this.data.length; i++) {
        const section = this.data[i];
        if (section.id === id) {
          return section.data;
        }
      }
      return null;
    }
  };
  WebmContainer.WebmContainer = WebmContainer$1;
  return WebmContainer;
}
var WebmFile = {};
var hasRequiredWebmFile;
function requireWebmFile() {
  if (hasRequiredWebmFile) return WebmFile;
  hasRequiredWebmFile = 1;
  Object.defineProperty(WebmFile, "__esModule", { value: true });
  WebmFile.WebmFile = void 0;
  const tslib_1 = /* @__PURE__ */ requireTslib();
  const WebmContainer_1 = requireWebmContainer();
  let WebmFile$1 = class WebmFile2 extends WebmContainer_1.WebmContainer {
    constructor(source) {
      super("File");
      this.setSource(source);
    }
    getType() {
      return "File";
    }
    toBlob(mimeType = "video/webm") {
      return new Blob([this.source.buffer], { type: mimeType });
    }
    static blobToArray(blob) {
      return new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              resolve(new Uint8Array(reader.result));
            } catch (ex) {
              reject(ex);
            }
          };
          reader.readAsArrayBuffer(blob);
        } catch (ex) {
          reject(ex);
        }
      });
    }
    static fromBlob(blob) {
      return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const array = yield WebmFile2.blobToArray(blob);
        return new WebmFile2(array);
      });
    }
  };
  WebmFile.WebmFile = WebmFile$1;
  return WebmFile;
}
var Options = {};
var hasRequiredOptions;
function requireOptions() {
  if (hasRequiredOptions) return Options;
  hasRequiredOptions = 1;
  Object.defineProperty(Options, "__esModule", { value: true });
  return Options;
}
var hasRequiredSrc$1;
function requireSrc$1() {
  if (hasRequiredSrc$1) return src;
  hasRequiredSrc$1 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = /* @__PURE__ */ requireTslib();
    tslib_1.__exportStar(requireWebmBase(), exports);
    tslib_1.__exportStar(requireWebmContainer(), exports);
    tslib_1.__exportStar(requireWebmFile(), exports);
    tslib_1.__exportStar(requireWebmFloat(), exports);
    tslib_1.__exportStar(requireWebmString(), exports);
    tslib_1.__exportStar(requireWebmUint(), exports);
    tslib_1.__exportStar(requireSectionType(), exports);
    tslib_1.__exportStar(requireOptions(), exports);
    tslib_1.__exportStar(requireSections(), exports);
  })(src);
  return src;
}
var fixParsedWebmDuration = {};
var hasRequiredFixParsedWebmDuration;
function requireFixParsedWebmDuration() {
  if (hasRequiredFixParsedWebmDuration) return fixParsedWebmDuration;
  hasRequiredFixParsedWebmDuration = 1;
  Object.defineProperty(fixParsedWebmDuration, "__esModule", { value: true });
  fixParsedWebmDuration.fixParsedWebmDuration = void 0;
  const parser_1 = requireSrc$1();
  const fixParsedWebmDuration$1 = (file, duration, options = {}) => {
    let logger = options.logger;
    if (logger === void 0) {
      logger = (message) => console.debug(message);
    } else if (!logger) {
      logger = () => {
      };
    }
    const segmentSection = file.getSectionById(139690087);
    if (!segmentSection) {
      logger("[fix-webm-duration] Segment section is missing");
      return false;
    }
    const infoSection = segmentSection.getSectionById(88713574);
    if (!infoSection) {
      logger("[fix-webm-duration] Info section is missing");
      return false;
    }
    const timeScaleSection = infoSection.getSectionById(710577);
    if (!timeScaleSection) {
      logger("[fix-webm-duration] TimecodeScale section is missing");
      return false;
    }
    let durationSection = infoSection.getSectionById(1161);
    if (durationSection) {
      if (durationSection.getValue() <= 0) {
        logger(`[fix-webm-duration] Duration section is present, but the value is ${durationSection.getValue()}`);
        durationSection.setValue(duration);
      } else {
        logger(`[fix-webm-duration] Duration section is present, and the value is ${durationSection.getValue()}`);
        return false;
      }
    } else {
      logger("[fix-webm-duration] Duration section is missing");
      durationSection = new parser_1.WebmFloat("Duration");
      durationSection.setValue(duration);
      infoSection.data.push({
        id: 1161,
        data: durationSection
      });
    }
    timeScaleSection.setValue(1e6);
    infoSection.updateByData();
    segmentSection.updateByData();
    file.updateByData();
    return true;
  };
  fixParsedWebmDuration.fixParsedWebmDuration = fixParsedWebmDuration$1;
  return fixParsedWebmDuration;
}
var hasRequiredFixWebmDuration;
function requireFixWebmDuration() {
  if (hasRequiredFixWebmDuration) return fixWebmDuration;
  hasRequiredFixWebmDuration = 1;
  Object.defineProperty(fixWebmDuration, "__esModule", { value: true });
  fixWebmDuration.fixWebmDuration = void 0;
  const tslib_1 = /* @__PURE__ */ requireTslib();
  const parser_1 = requireSrc$1();
  const fixParsedWebmDuration_1 = requireFixParsedWebmDuration();
  const fixWebmDuration$1 = (blob, duration, options) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    try {
      const file = yield parser_1.WebmFile.fromBlob(blob);
      if ((0, fixParsedWebmDuration_1.fixParsedWebmDuration)(file, duration, options)) {
        return file.toBlob(blob.type);
      }
    } catch (_a) {
    }
    return blob;
  });
  fixWebmDuration.fixWebmDuration = fixWebmDuration$1;
  return fixWebmDuration;
}
var hasRequiredSrc;
function requireSrc() {
  if (hasRequiredSrc) return src$1;
  hasRequiredSrc = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = /* @__PURE__ */ requireTslib();
    tslib_1.__exportStar(requireFixWebmDuration(), exports);
    tslib_1.__exportStar(requireFixParsedWebmDuration(), exports);
  })(src$1);
  return src$1;
}
var srcExports$1 = requireSrc();
var srcExports = requireSrc$1();
async function patchWebmDurationOnDisk(filePath, durationMs) {
  try {
    const fileBytes = await fs.readFile(filePath);
    const webm = new srcExports.WebmFile(new Uint8Array(fileBytes));
    const patched = srcExports$1.fixParsedWebmDuration(webm, durationMs, { logger: false });
    if (!patched) {
      const reason = inferUnpatchedReason(webm);
      if (reason === "no-section") {
        console.warn(
          `[webm-duration] no Segment/Info section in ${filePath}; file may be truncated`
        );
      }
      return { patched: false, reason };
    }
    if (!webm.source) {
      console.error(`[webm-duration] patched but source missing for ${filePath}`);
      return { patched: false, reason: "internal" };
    }
    const tmpPath = `${filePath}.duration-patch.tmp`;
    const patchedBytes = Buffer.from(
      webm.source.buffer,
      webm.source.byteOffset,
      webm.source.byteLength
    );
    try {
      await fs.writeFile(tmpPath, patchedBytes);
      await fs.rename(tmpPath, filePath);
      return { patched: true };
    } catch (writeError) {
      console.error(`[webm-duration] failed to write patched ${filePath}:`, writeError);
      await fs.unlink(tmpPath).catch(() => void 0);
      return { patched: false, reason: "io-error" };
    }
  } catch (error) {
    console.error(`[webm-duration] failed to patch ${filePath}:`, error);
    return { patched: false, reason: "io-error" };
  }
}
function inferUnpatchedReason(webm) {
  const segment = webm.getSectionById?.(139690087);
  if (!segment) return "no-section";
  const info = segment.getSectionById?.(88713574);
  return info ? "already-valid" : "no-section";
}
const NATIVE_BRIDGE_CHANNEL = "native-bridge:invoke";
const NATIVE_BRIDGE_VERSION = 1;
class TelemetryCursorAdapter {
  constructor(options) {
    this.options = options;
  }
  options;
  kind = "none";
  async getCapabilities() {
    return {
      telemetry: true,
      systemAssets: false,
      provider: this.kind
    };
  }
  async getRecordingData(videoPath) {
    const resolvedVideoPath = this.options.resolveVideoPath(videoPath);
    if (!resolvedVideoPath) {
      return {
        version: 2,
        provider: this.kind,
        samples: [],
        assets: []
      };
    }
    return this.options.loadRecordingData(resolvedVideoPath);
  }
  async getTelemetry(videoPath) {
    const resolvedVideoPath = this.options.resolveVideoPath(videoPath);
    if (!resolvedVideoPath) {
      return {
        success: false,
        message: "No video path is available for cursor telemetry",
        samples: []
      };
    }
    return this.options.loadTelemetry(resolvedVideoPath);
  }
}
class CursorService {
  constructor(options) {
    this.options = options;
  }
  options;
  async getCapabilities() {
    const capabilities = await this.options.adapter.getCapabilities();
    this.options.store.setCursorCapabilities(capabilities);
    return capabilities;
  }
  async getTelemetry(videoPath) {
    const result = await this.options.adapter.getTelemetry(videoPath);
    if (!result.success) {
      throw new Error(result.message || result.error || "Failed to load cursor telemetry");
    }
    const resolvedVideoPath = videoPath ?? this.options.store.getState().project.currentVideoPath;
    if (resolvedVideoPath) {
      this.options.store.markCursorTelemetryLoaded(resolvedVideoPath, result.samples.length);
    }
    return result.samples;
  }
  async getRecordingData(videoPath) {
    const data = await this.options.adapter.getRecordingData(videoPath);
    const resolvedVideoPath = videoPath ?? this.options.store.getState().project.currentVideoPath;
    if (resolvedVideoPath) {
      this.options.store.markCursorTelemetryLoaded(resolvedVideoPath, data.samples.length);
    }
    return data;
  }
}
class ProjectService {
  constructor(options) {
    this.options = options;
  }
  options;
  getCurrentContext() {
    const context = {
      currentProjectPath: this.options.getCurrentProjectPath(),
      currentVideoPath: this.options.getCurrentVideoPath()
    };
    this.options.store.setProjectContext(context);
    return context;
  }
  async saveProjectFile(projectData, suggestedName, existingProjectPath) {
    const result = await this.options.saveProjectFile(
      projectData,
      suggestedName,
      existingProjectPath
    );
    this.getCurrentContext();
    return result;
  }
  async loadProjectFile(projectFolder) {
    const result = await this.options.loadProjectFile(projectFolder);
    this.getCurrentContext();
    return result;
  }
  async loadCurrentProjectFile() {
    const result = await this.options.loadCurrentProjectFile();
    this.getCurrentContext();
    return result;
  }
  async loadProjectFileFromPath(path2) {
    const result = await this.options.loadProjectFileFromPath(path2);
    this.getCurrentContext();
    return result;
  }
  async setCurrentVideoPath(path2) {
    const result = await this.options.setCurrentVideoPath(path2);
    this.getCurrentContext();
    return result;
  }
  getCurrentVideoPath() {
    const result = this.options.getCurrentVideoPathResult();
    this.getCurrentContext();
    return result;
  }
  clearCurrentVideoPath() {
    const result = this.options.clearCurrentVideoPath();
    this.getCurrentContext();
    return result;
  }
}
class SystemService {
  constructor(options) {
    this.options = options;
  }
  options;
  getPlatform() {
    return this.options.getPlatform();
  }
  getAssetBasePath() {
    return this.options.getAssetBasePath();
  }
  async getCapabilities() {
    const platform = this.getPlatform();
    const cursorCapabilities = await this.options.getCursorCapabilities();
    const capabilities = {
      bridgeVersion: NATIVE_BRIDGE_VERSION,
      platform,
      cursor: cursorCapabilities,
      project: {
        currentContext: true
      }
    };
    this.options.store.setSystemCapabilities(capabilities);
    return capabilities;
  }
}
class NativeBridgeStateStore {
  state;
  constructor(platform) {
    this.state = {
      system: {
        platform,
        capabilities: null
      },
      project: {
        currentProjectPath: null,
        currentVideoPath: null
      },
      cursor: {
        capabilities: null,
        lastTelemetryLoad: null
      }
    };
  }
  getState() {
    return this.state;
  }
  setProjectContext(project) {
    this.state = {
      ...this.state,
      project
    };
  }
  setSystemCapabilities(capabilities) {
    this.state = {
      ...this.state,
      system: {
        ...this.state.system,
        capabilities
      }
    };
  }
  setCursorCapabilities(capabilities) {
    this.state = {
      ...this.state,
      cursor: {
        ...this.state.cursor,
        capabilities
      }
    };
  }
  markCursorTelemetryLoaded(videoPath, sampleCount) {
    this.state = {
      ...this.state,
      cursor: {
        ...this.state.cursor,
        lastTelemetryLoad: {
          videoPath,
          sampleCount,
          loadedAt: Date.now()
        }
      }
    };
  }
}
function normalizePlatform(platform) {
  if (platform === "darwin" || platform === "win32") {
    return platform;
  }
  return "linux";
}
function createMeta(requestId) {
  return {
    version: NATIVE_BRIDGE_VERSION,
    requestId: requestId || `native-${Date.now()}`,
    timestampMs: Date.now()
  };
}
function createSuccessResponse(requestId, data) {
  return {
    ok: true,
    data,
    meta: createMeta(requestId)
  };
}
function createErrorResponse(requestId, code, message, retryable = false) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable
    },
    meta: createMeta(requestId)
  };
}
function isBridgeRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.domain === "string" && typeof candidate.action === "string";
}
function registerNativeBridgeHandlers(context) {
  ipcMain.removeHandler(NATIVE_BRIDGE_CHANNEL);
  const platform = normalizePlatform(context.getPlatform());
  const store = new NativeBridgeStateStore(platform);
  const projectService = new ProjectService({
    store,
    getCurrentProjectPath: context.getCurrentProjectPath,
    getCurrentVideoPath: context.getCurrentVideoPath,
    saveProjectFile: context.saveProjectFile,
    loadProjectFile: context.loadProjectFile,
    loadCurrentProjectFile: context.loadCurrentProjectFile,
    loadProjectFileFromPath: context.loadProjectFileFromPath,
    setCurrentVideoPath: context.setCurrentVideoPath,
    getCurrentVideoPathResult: context.getCurrentVideoPathResult,
    clearCurrentVideoPath: context.clearCurrentVideoPath
  });
  const cursorService = new CursorService({
    store,
    adapter: new TelemetryCursorAdapter({
      loadRecordingData: context.loadCursorRecordingData,
      resolveVideoPath: context.resolveVideoPath,
      loadTelemetry: context.loadCursorTelemetry
    })
  });
  const systemService = new SystemService({
    store,
    getPlatform: () => platform,
    getAssetBasePath: context.resolveAssetBasePath,
    getCursorCapabilities: () => cursorService.getCapabilities()
  });
  ipcMain.handle(NATIVE_BRIDGE_CHANNEL, async (_, request) => {
    if (!isBridgeRequest(request)) {
      return createErrorResponse(void 0, "INVALID_REQUEST", "Invalid native bridge request.");
    }
    const requestId = request.requestId;
    const domain = request.domain;
    try {
      switch (request.domain) {
        case "system": {
          const action = request.action;
          switch (request.action) {
            case "getPlatform":
              return createSuccessResponse(requestId, systemService.getPlatform());
            case "getAssetBasePath":
              return createSuccessResponse(requestId, systemService.getAssetBasePath());
            case "getCapabilities":
              return createSuccessResponse(requestId, await systemService.getCapabilities());
            default:
              return createErrorResponse(
                requestId,
                "UNSUPPORTED_ACTION",
                `Unsupported system action: ${action}`
              );
          }
        }
        case "project": {
          const action = request.action;
          switch (request.action) {
            case "getCurrentContext":
              return createSuccessResponse(requestId, projectService.getCurrentContext());
            case "saveProjectFile":
              return createSuccessResponse(
                requestId,
                await projectService.saveProjectFile(
                  request.payload.projectData,
                  request.payload.suggestedName,
                  request.payload.existingProjectPath
                )
              );
            case "loadProjectFile":
              return createSuccessResponse(
                requestId,
                await projectService.loadProjectFile(request.payload?.projectFolder)
              );
            case "loadCurrentProjectFile":
              return createSuccessResponse(
                requestId,
                await projectService.loadCurrentProjectFile()
              );
            case "loadProjectFileFromPath":
              return createSuccessResponse(
                requestId,
                await projectService.loadProjectFileFromPath(request.payload.path)
              );
            case "setCurrentVideoPath":
              return createSuccessResponse(
                requestId,
                await projectService.setCurrentVideoPath(request.payload.path)
              );
            case "getCurrentVideoPath":
              return createSuccessResponse(requestId, projectService.getCurrentVideoPath());
            case "clearCurrentVideoPath":
              return createSuccessResponse(requestId, projectService.clearCurrentVideoPath());
            default:
              return createErrorResponse(
                requestId,
                "UNSUPPORTED_ACTION",
                `Unsupported project action: ${action}`
              );
          }
        }
        case "cursor": {
          const action = request.action;
          switch (request.action) {
            case "getCapabilities":
              return createSuccessResponse(requestId, await cursorService.getCapabilities());
            case "getTelemetry":
              return createSuccessResponse(
                requestId,
                await cursorService.getTelemetry(request.payload?.videoPath)
              );
            case "getRecordingData":
              return createSuccessResponse(
                requestId,
                await cursorService.getRecordingData(request.payload?.videoPath)
              );
            default:
              return createErrorResponse(
                requestId,
                "UNSUPPORTED_ACTION",
                `Unsupported cursor action: ${action}`
              );
          }
        }
        default:
          return createErrorResponse(
            requestId,
            "UNSUPPORTED_ACTION",
            `Unsupported bridge domain: ${domain}`
          );
      }
    } catch (error) {
      return createErrorResponse(
        requestId,
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unknown native bridge error.",
        true
      );
    }
  });
}
class RecordingStreamRegistry {
  streams = /* @__PURE__ */ new Map();
  /**
   * Open a write stream, resolving only on the `open` event so a bad path or
   * permission error rejects here instead of becoming a silent chunk drop later,
   * letting the renderer's fallback take over.
   */
  async open(fileName, filePath) {
    await this.endStream(fileName);
    const ws = createWriteStream(filePath, { flags: "w" });
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      ws.once("error", onError);
      ws.once("open", () => {
        ws.removeListener("error", onError);
        resolve();
      });
    });
    ws.on("error", (error) => {
      console.error(`[recording-stream] ${fileName}:`, error);
    });
    this.streams.set(fileName, ws);
  }
  has(fileName) {
    return this.streams.has(fileName);
  }
  /** Append a chunk; rejects if no stream is open or the write fails. */
  async append(fileName, chunk) {
    const ws = this.streams.get(fileName);
    if (!ws) {
      throw new Error(`No active recording stream for ${fileName}`);
    }
    await new Promise((resolve, reject) => {
      ws.write(chunk, (error) => error ? reject(error) : resolve());
    });
  }
  /**
   * Flush and close the stream, keeping the file. Returns true if a stream was
   * open (streamed to disk) or false if the caller still needs to write its buffer.
   */
  async finalize(fileName) {
    const ws = this.streams.get(fileName);
    if (!ws) {
      return false;
    }
    this.streams.delete(fileName);
    await new Promise((resolve, reject) => {
      ws.end((error) => error ? reject(error) : resolve());
    });
    return true;
  }
  /**
   * Close the stream (if any) and delete the partial file, so a discarded or
   * failed recording doesn't leak descriptors or orphan partial files on disk.
   */
  async discard(fileName, filePath) {
    await this.endStream(fileName);
    await unlink(filePath).catch(() => void 0);
  }
  async endStream(fileName) {
    const ws = this.streams.get(fileName);
    if (!ws) {
      return;
    }
    this.streams.delete(fileName);
    await new Promise((resolve) => ws.end(() => resolve()));
  }
}
function registerRecordingStreamHandlers(ipcMain2, registry, resolveRecordingOutputPath2) {
  ipcMain2.handle(
    "open-recording-stream",
    async (_, fileName) => {
      try {
        await registry.open(fileName, resolveRecordingOutputPath2(fileName));
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );
  ipcMain2.handle(
    "append-recording-chunk",
    async (_, fileName, chunk) => {
      try {
        await registry.append(fileName, Buffer.from(chunk));
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );
  ipcMain2.handle(
    "close-recording-stream",
    async (_, fileName) => {
      try {
        await registry.discard(fileName, resolveRecordingOutputPath2(fileName));
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );
}
const PROJECT_FILE_EXTENSION = "openscreen";
const SHORTCUTS_FILE = path.join(app.getPath("userData"), "shortcuts.json");
const RECORDING_FILE_PREFIX = "recording-";
const RECORDING_SESSION_SUFFIX = ".session.json";
const ALLOWED_IMPORT_VIDEO_EXTENSIONS = /* @__PURE__ */ new Set([
  ".webm",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
  ".wmv",
  ".flv",
  ".ts"
]);
const ALLOWED_IMPORT_VIDEO_EXTENSIONS_LIST = [...ALLOWED_IMPORT_VIDEO_EXTENSIONS].map(
  (ext) => ext.slice(1)
);
const PREVIEW_AUDIO_DIR = path.join(app.getPath("userData"), "preview-audio");
const nativeMacCaptureEvents = new EventEmitter();
const approvedPaths = /* @__PURE__ */ new Set();
function approveFilePath(filePath) {
  approvedPaths.add(path.resolve(filePath));
}
function getAllowedReadDirs() {
  return [RECORDINGS_DIR];
}
function isPathWithinDir(filePath, dirPath) {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(dirPath);
  return resolved === resolvedDir || resolved.startsWith(resolvedDir + path.sep);
}
function isPathAllowed(filePath) {
  const resolved = path.resolve(filePath);
  if (approvedPaths.has(resolved)) return true;
  return getAllowedReadDirs().some((dir) => isPathWithinDir(resolved, dir));
}
function resolveApprovedVideoPath(videoPath) {
  const normalizedPath = normalizeVideoSourcePath(videoPath);
  if (!normalizedPath) {
    return null;
  }
  if (!hasAllowedImportVideoExtension(normalizedPath) || !isPathAllowed(normalizedPath)) {
    return null;
  }
  return normalizedPath;
}
function buildDialogOptions(baseOptions, parentWindow) {
  const mainWindow2 = parentWindow;
  if (mainWindow2 && !mainWindow2.isDestroyed()) {
    return { ...baseOptions, parent: mainWindow2 };
  }
  return baseOptions;
}
function hasAllowedImportVideoExtension(filePath) {
  return ALLOWED_IMPORT_VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
function parseAfinfoAudioTrackBitrates(output) {
  const bitrates = [];
  const trackSections = output.split(/\n----\n/g).slice(1);
  for (const section of trackSections) {
    const match = section.match(/\bbit rate:\s*([0-9]+)\s*bits per second/i);
    bitrates.push(match ? Number(match[1]) : 0);
  }
  return bitrates;
}
async function prepareSupplementalPreviewAudioTrack(videoPath) {
  const normalizedPath = await approveReadableVideoPath(videoPath);
  if (!normalizedPath) {
    return {
      success: false,
      message: "File path is not approved or is not a supported video file"
    };
  }
  if (process.platform !== "darwin" || path.extname(normalizedPath).toLowerCase() !== ".mp4") {
    return { success: true, path: null };
  }
  const afinfo = await runProcess("/usr/bin/afinfo", [normalizedPath]);
  if (afinfo.code !== 0) {
    return { success: true, path: null };
  }
  const bitrates = parseAfinfoAudioTrackBitrates(`${afinfo.stdout}
${afinfo.stderr}`);
  if (bitrates.length <= 1) {
    return { success: true, path: null };
  }
  let supplementalTrackIndex = 1;
  for (let index = 2; index < bitrates.length; index += 1) {
    if (bitrates[index] > bitrates[supplementalTrackIndex]) {
      supplementalTrackIndex = index;
    }
  }
  await fs.mkdir(PREVIEW_AUDIO_DIR, { recursive: true });
  const sourceStat = await fs.stat(normalizedPath);
  const parsedPath = path.parse(normalizedPath);
  const outputPath = path.join(
    PREVIEW_AUDIO_DIR,
    `${parsedPath.name}.track-${supplementalTrackIndex}.${Math.round(sourceStat.mtimeMs)}.m4a`
  );
  try {
    const outputStat = await fs.stat(outputPath);
    if (outputStat.mtimeMs >= sourceStat.mtimeMs) {
      return { success: true, path: pathToFileURL(outputPath).toString() };
    }
  } catch {
  }
  const conversion = await runProcess("/usr/bin/afconvert", [
    "--read-track",
    String(supplementalTrackIndex),
    "-f",
    "m4af",
    "-d",
    "aac",
    normalizedPath,
    outputPath
  ]);
  if (conversion.code !== 0) {
    return {
      success: false,
      message: conversion.stderr || conversion.stdout || "Failed to prepare preview audio"
    };
  }
  return { success: true, path: pathToFileURL(outputPath).toString() };
}
async function approveReadableVideoPath(filePath, trustedDirs) {
  const normalizedPath = normalizeVideoSourcePath(filePath);
  if (!normalizedPath) {
    return null;
  }
  if (isPathAllowed(normalizedPath)) {
    return normalizedPath;
  }
  if (!hasAllowedImportVideoExtension(normalizedPath)) {
    return null;
  }
  if (trustedDirs) {
    const resolved = path.resolve(normalizedPath);
    const withinTrusted = trustedDirs.some((dir) => isPathWithinDir(resolved, dir));
    if (!withinTrusted) {
      return null;
    }
  }
  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isFile()) {
      return null;
    }
  } catch {
    return null;
  }
  approveFilePath(normalizedPath);
  return normalizedPath;
}
function resolveRecordingOutputPath(fileName) {
  const trimmed = fileName.trim();
  if (!trimmed) {
    throw new Error("Invalid recording file name");
  }
  const parsedPath = path.parse(trimmed);
  const hasTraversalSegments = trimmed.split(/[\\/]+/).some((segment) => segment === "..");
  const isNestedPath = parsedPath.dir !== "" || path.isAbsolute(trimmed) || trimmed.includes("/") || trimmed.includes("\\");
  if (hasTraversalSegments || isNestedPath || parsedPath.base !== trimmed) {
    throw new Error("Recording file name must not contain path segments");
  }
  return path.join(RECORDINGS_DIR, parsedPath.base);
}
function isValidDurationMs(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
async function finalizeRecordingFile(registry, fileName, filePath, videoData) {
  const streamed = await registry.finalize(fileName);
  if (!streamed && videoData && videoData.byteLength > 0) {
    await fs.writeFile(filePath, Buffer.from(videoData));
  }
  return streamed;
}
async function getApprovedProjectSession(project, projectFilePath) {
  if (!project || typeof project !== "object") {
    return null;
  }
  const rawProject = project;
  const media = normalizeProjectMedia(rawProject.media) ?? (typeof rawProject.videoPath === "string" ? {
    screenVideoPath: normalizeVideoSourcePath(rawProject.videoPath) ?? rawProject.videoPath
  } : null);
  if (!media) {
    return null;
  }
  const trustedDirs = [RECORDINGS_DIR];
  if (projectFilePath) {
    trustedDirs.push(path.dirname(path.resolve(projectFilePath)));
  }
  const screenVideoPath = await approveReadableVideoPath(media.screenVideoPath, trustedDirs);
  if (!screenVideoPath) {
    throw new Error("Project references an invalid or unsupported screen video path");
  }
  const webcamVideoPath = media.webcamVideoPath ? await approveReadableVideoPath(media.webcamVideoPath, trustedDirs) : void 0;
  if (media.webcamVideoPath && !webcamVideoPath) {
    throw new Error("Project references an invalid or unsupported webcam video path");
  }
  return webcamVideoPath ? { screenVideoPath, webcamVideoPath, createdAt: Date.now() } : { screenVideoPath, createdAt: Date.now() };
}
let selectedSource = null;
let selectedDesktopSource = null;
let lastEnumeratedSources = /* @__PURE__ */ new Map();
let currentProjectPath = null;
let currentRecordingSession = null;
const SELECTED_SOURCE_FILE = path.join(app.getPath("userData"), "selected-source.json");
let selectedSourceRestoreAttempted = false;
async function persistSelectedSource(source) {
  try {
    if (!source) {
      await fs.rm(SELECTED_SOURCE_FILE, { force: true });
      return;
    }
    const payload = {
      id: typeof source.id === "string" ? source.id : void 0,
      name: typeof source.name === "string" ? source.name : void 0,
      display_id: typeof source.display_id === "string" ? source.display_id : void 0
    };
    await fs.writeFile(SELECTED_SOURCE_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (error) {
    console.warn("Failed to persist selected source:", error);
  }
}
async function restoreSelectedSource() {
  if (selectedSourceRestoreAttempted) {
    return null;
  }
  selectedSourceRestoreAttempted = true;
  let persisted = null;
  try {
    persisted = JSON.parse(
      await fs.readFile(SELECTED_SOURCE_FILE, "utf-8")
    );
  } catch {
    return null;
  }
  if (!persisted || typeof persisted.id !== "string" || !persisted.id) {
    return null;
  }
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    });
    const match = sources.find((source) => source.id === persisted.id);
    if (!match) {
      return null;
    }
    lastEnumeratedSources = new Map(sources.map((source) => [source.id, source]));
    selectedDesktopSource = match;
    const restored = {
      id: match.id,
      name: match.name,
      display_id: match.display_id
    };
    selectedSource = restored;
    return restored;
  } catch (error) {
    console.warn("Failed to restore selected source:", error);
    return null;
  }
}
function getSelectedDesktopSource() {
  return selectedDesktopSource;
}
let currentVideoPath = null;
function normalizePath(filePath) {
  return path.resolve(filePath);
}
function normalizeVideoSourcePath(videoPath) {
  if (typeof videoPath !== "string") {
    return null;
  }
  const trimmed = videoPath.trim();
  if (!trimmed) {
    return null;
  }
  if (/^file:\/\//i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed);
    } catch {
    }
  }
  return trimmed;
}
function isTrustedProjectPath(filePath) {
  if (!filePath || !currentProjectPath) {
    return false;
  }
  return normalizePath(filePath) === normalizePath(currentProjectPath);
}
const CURSOR_TELEMETRY_VERSION = 2;
const CURSOR_SAMPLE_INTERVAL_MS = 33;
const MAX_CURSOR_SAMPLES = 60 * 60 * 30;
let cursorRecordingSession = null;
let pendingCursorRecordingData = null;
let nativeWindowsCaptureProcess = null;
let nativeWindowsCaptureOutput = "";
let nativeWindowsCaptureTargetPath = null;
let nativeWindowsCaptureWebcamTargetPath = null;
let nativeWindowsCaptureRecordingId = null;
let nativeWindowsCursorOffsetMs = 0;
let nativeWindowsCursorCaptureMode = "editable-overlay";
let nativeWindowsCursorRecordingStartMs = 0;
let nativeWindowsPauseStartedAtMs = null;
let nativeWindowsPauseRanges = [];
let nativeWindowsIsPaused = false;
const NATIVE_WINDOWS_CAPTURE_STOP_TIMEOUT_MS = 15e3;
let nativeMacCaptureProcess = null;
let nativeMacCaptureOutput = "";
let nativeMacCaptureTargetPath = null;
let nativeMacCaptureRecordingId = null;
let nativeMacCursorOffsetMs = 0;
let nativeMacCursorCaptureMode = "editable-overlay";
let nativeMacCursorRecordingStartMs = 0;
let nativeMacPauseStartedAtMs = null;
let nativeMacPauseRanges = [];
let nativeMacIsPaused = false;
function normalizeCursorSample(sample) {
  if (!sample || typeof sample !== "object") {
    return null;
  }
  const point = sample;
  const interactionType = point.interactionType === "click" || point.interactionType === "mouseup" || point.interactionType === "move" ? point.interactionType : "move";
  return {
    timeMs: typeof point.timeMs === "number" && Number.isFinite(point.timeMs) ? Math.max(0, point.timeMs) : 0,
    cx: typeof point.cx === "number" && Number.isFinite(point.cx) ? point.cx : 0.5,
    cy: typeof point.cy === "number" && Number.isFinite(point.cy) ? point.cy : 0.5,
    assetId: typeof point.assetId === "string" ? point.assetId : null,
    visible: typeof point.visible === "boolean" ? point.visible : true,
    cursorType: typeof point.cursorType === "string" ? point.cursorType : null,
    interactionType
  };
}
function normalizeCursorAsset(asset) {
  if (!asset || typeof asset !== "object") {
    return null;
  }
  const candidate = asset;
  if (typeof candidate.id !== "string" || typeof candidate.imageDataUrl !== "string") {
    return null;
  }
  return {
    id: candidate.id,
    platform: candidate.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux",
    imageDataUrl: candidate.imageDataUrl,
    width: typeof candidate.width === "number" && Number.isFinite(candidate.width) ? Math.max(1, Math.round(candidate.width)) : 1,
    height: typeof candidate.height === "number" && Number.isFinite(candidate.height) ? Math.max(1, Math.round(candidate.height)) : 1,
    hotspotX: typeof candidate.hotspotX === "number" && Number.isFinite(candidate.hotspotX) ? Math.max(0, Math.round(candidate.hotspotX)) : 0,
    hotspotY: typeof candidate.hotspotY === "number" && Number.isFinite(candidate.hotspotY) ? Math.max(0, Math.round(candidate.hotspotY)) : 0,
    scaleFactor: typeof candidate.scaleFactor === "number" && Number.isFinite(candidate.scaleFactor) ? Math.max(0.1, candidate.scaleFactor) : void 0,
    cursorType: typeof candidate.cursorType === "string" ? candidate.cursorType : null
  };
}
async function readCursorRecordingFile(targetVideoPath) {
  const telemetryPath = `${targetVideoPath}.cursor.json`;
  try {
    const content = await fs.readFile(telemetryPath, "utf-8");
    const parsed = JSON.parse(content);
    const rawSamples = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.samples) ? parsed.samples : [];
    const rawAssets = Array.isArray(parsed?.assets) ? parsed.assets : [];
    const samples = rawSamples.map((sample) => normalizeCursorSample(sample)).filter(
      (sample) => Boolean(sample)
    ).sort((a, b) => a.timeMs - b.timeMs);
    const assets = rawAssets.map((asset) => normalizeCursorAsset(asset)).filter((asset) => Boolean(asset));
    return {
      version: typeof parsed?.version === "number" && Number.isFinite(parsed.version) ? parsed.version : 1,
      provider: parsed?.provider === "native" ? "native" : "none",
      samples,
      assets
    };
  } catch (error) {
    const nodeError = error;
    if (nodeError.code === "ENOENT") {
      return {
        version: CURSOR_TELEMETRY_VERSION,
        provider: "none",
        samples: [],
        assets: []
      };
    }
    console.error("Failed to load cursor telemetry:", error);
    throw error;
  }
}
async function readCursorTelemetryFile(targetVideoPath) {
  try {
    const recordingData = await readCursorRecordingFile(targetVideoPath);
    return {
      success: true,
      samples: recordingData.samples.map((sample) => ({
        timeMs: sample.timeMs,
        cx: sample.cx,
        cy: sample.cy
      }))
    };
  } catch (error) {
    console.error("Failed to load cursor telemetry:", error);
    return {
      success: false,
      message: "Failed to load cursor telemetry",
      error: String(error),
      samples: []
    };
  }
}
function resolveAssetBasePath() {
  try {
    if (app.isPackaged) {
      const assetPath2 = path.join(process.resourcesPath, "assets");
      return pathToFileURL(`${assetPath2}${path.sep}`).toString();
    }
    const assetPath = path.join(app.getAppPath(), "public", "assets");
    return pathToFileURL(`${assetPath}${path.sep}`).toString();
  } catch (err) {
    console.error("Failed to resolve asset base path:", err);
    return null;
  }
}
function getSelectedSourceBounds() {
  const cursor = screen.getCursorScreenPoint();
  const sourceDisplayId = Number(selectedSource?.display_id);
  const sourceDisplay = Number.isFinite(sourceDisplayId) ? screen.getAllDisplays().find((display) => display.id === sourceDisplayId) ?? null : null;
  return (sourceDisplay ?? screen.getDisplayNearestPoint(cursor)).bounds;
}
function getSelectedSourceId() {
  return typeof selectedSource?.id === "string" ? selectedSource.id : null;
}
function getSelectedDisplay() {
  const sourceDisplayId = Number(selectedSource?.display_id);
  if (!Number.isFinite(sourceDisplayId)) {
    return null;
  }
  return screen.getAllDisplays().find((display) => display.id === sourceDisplayId) ?? null;
}
function resolveUnpackedAppPath(...segments) {
  const resolved = path.join(app.getAppPath(), ...segments);
  if (app.isPackaged) {
    return resolved.replace(/\.asar([/\\])/, ".asar.unpacked$1");
  }
  return resolved;
}
function resolvePackagedResourcePath(...segments) {
  if (!app.isPackaged) {
    return null;
  }
  return path.join(process.resourcesPath, ...segments);
}
function getNativeWindowsCaptureHelperCandidates() {
  const envPath = process.env.OPENSCREEN_WGC_CAPTURE_EXE?.trim();
  const archTag = process.arch === "arm64" ? "win32-arm64" : "win32-x64";
  return [
    envPath,
    resolveUnpackedAppPath(
      "electron",
      "native",
      "wgc-capture",
      "build",
      "Release",
      "wgc-capture.exe"
    ),
    resolveUnpackedAppPath("electron", "native", "wgc-capture", "build", "wgc-capture.exe"),
    resolveUnpackedAppPath("electron", "native", "bin", archTag, "wgc-capture.exe"),
    resolvePackagedResourcePath("electron", "native", "bin", archTag, "wgc-capture.exe")
  ].filter((candidate) => Boolean(candidate));
}
async function findNativeWindowsCaptureHelperPath() {
  if (process.platform !== "win32") {
    return null;
  }
  for (const candidate of getNativeWindowsCaptureHelperCandidates()) {
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
function getNativeMacCaptureHelperCandidates() {
  const envPath = process.env.OPENSCREEN_SCK_CAPTURE_EXE?.trim();
  const archTag = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  const helperName = "openscreen-screencapturekit-helper";
  return [
    envPath,
    resolveUnpackedAppPath("electron", "native", "screencapturekit", "build", helperName),
    resolveUnpackedAppPath("electron", "native", "bin", archTag, helperName),
    resolvePackagedResourcePath("electron", "native", "bin", archTag, helperName)
  ].filter((candidate) => Boolean(candidate));
}
async function findNativeMacCaptureHelperPath() {
  if (process.platform !== "darwin") {
    return null;
  }
  for (const candidate of getNativeMacCaptureHelperCandidates()) {
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
function isWindowsGraphicsCaptureOsSupported() {
  if (process.platform !== "win32") {
    return false;
  }
  const [, , build] = process.getSystemVersion().split(".").map(Number);
  return Number.isFinite(build) && build >= 19041;
}
function normalizeNativeDeviceName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function scoreNativeDeviceName(candidateName, candidateId, requestedName) {
  const candidate = normalizeNativeDeviceName(candidateName);
  const id = normalizeNativeDeviceName(candidateId);
  const requested = normalizeNativeDeviceName(requestedName ?? "");
  if (!requested) {
    return 0;
  }
  if (candidate === requested) {
    return 1e3;
  }
  if (candidate.includes(requested) || requested.includes(candidate)) {
    return 900;
  }
  if (id.includes(requested) || requested.includes(id)) {
    return 800;
  }
  return requested.split(/\s+/).filter((word) => word.length > 1 && !["camera", "webcam", "video", "input"].includes(word)).reduce((score, word) => {
    if (candidate.includes(word)) return score + 100;
    if (id.includes(word)) return score + 50;
    return score;
  }, 0);
}
function queryDirectShowVideoInputRegistry() {
  return new Promise((resolve) => {
    const proc = spawn(
      "reg.exe",
      ["query", "HKCR\\CLSID\\{860BB310-5D01-11D0-BD3B-00A0C911CE86}\\Instance", "/s"],
      { windowsHide: true }
    );
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf16le").includes("\0") ? chunk.toString("utf16le") : chunk.toString();
    });
    proc.on("close", () => resolve(stdout));
    proc.on("error", () => resolve(""));
  });
}
async function resolveDirectShowWebcamClsid(deviceName) {
  if (process.platform !== "win32" || !deviceName?.trim()) {
    return null;
  }
  const output = await queryDirectShowVideoInputRegistry();
  let current = {};
  const entries = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^HKEY_/i.test(line)) {
      if (current.friendlyName || current.clsid) entries.push(current);
      current = {};
      continue;
    }
    const match = line.match(/^(\S+)\s+REG_SZ\s+(.+)$/);
    if (!match) continue;
    if (match[1] === "FriendlyName") current.friendlyName = match[2].trim();
    if (match[1] === "CLSID") current.clsid = match[2].trim();
  }
  if (current.friendlyName || current.clsid) entries.push(current);
  let best = null;
  for (const entry of entries) {
    if (!entry.clsid) continue;
    const score = scoreNativeDeviceName(entry.friendlyName ?? "", entry.clsid, deviceName);
    if (!best || score > best.score) {
      best = { clsid: entry.clsid, friendlyName: entry.friendlyName, score };
    }
  }
  if (!best || best.score <= 0) {
    return null;
  }
  console.info("[native-wgc] resolved DirectShow webcam filter", {
    requestedName: deviceName,
    filterName: best.friendlyName,
    clsid: best.clsid,
    score: best.score
  });
  return best.clsid;
}
async function startCursorRecording(recordingId) {
  if (cursorRecordingSession) {
    pendingCursorRecordingData = await cursorRecordingSession.stop();
    cursorRecordingSession = null;
  }
  pendingCursorRecordingData = null;
  cursorRecordingSession = createCursorRecordingSession({
    getDisplayBounds: getSelectedSourceBounds,
    maxSamples: MAX_CURSOR_SAMPLES,
    platform: process.platform,
    sampleIntervalMs: CURSOR_SAMPLE_INTERVAL_MS,
    sourceId: getSelectedSourceId(),
    startTimeMs: typeof recordingId === "number" && Number.isFinite(recordingId) ? recordingId : void 0
  });
  try {
    await cursorRecordingSession.start();
  } catch (error) {
    console.error("Failed to start cursor recording session:", error);
    cursorRecordingSession = null;
  }
}
async function stopCursorRecording() {
  if (!cursorRecordingSession) {
    return;
  }
  try {
    pendingCursorRecordingData = await cursorRecordingSession.stop();
  } catch (error) {
    console.error("Failed to stop cursor recording session:", error);
    pendingCursorRecordingData = null;
  } finally {
    cursorRecordingSession = null;
  }
}
async function writePendingCursorTelemetry(videoPath) {
  const telemetryPath = `${videoPath}.cursor.json`;
  if (pendingCursorRecordingData && pendingCursorRecordingData.samples.length > 0) {
    await fs.writeFile(telemetryPath, JSON.stringify(pendingCursorRecordingData, null, 2), "utf-8");
  }
  pendingCursorRecordingData = null;
}
function shiftPendingCursorTelemetry(offsetMs) {
  if (!pendingCursorRecordingData || !Number.isFinite(offsetMs) || offsetMs <= 0) {
    return;
  }
  pendingCursorRecordingData = {
    ...pendingCursorRecordingData,
    samples: pendingCursorRecordingData.samples.map((sample) => ({
      ...sample,
      timeMs: Math.max(0, sample.timeMs - offsetMs)
    })).sort((a, b) => a.timeMs - b.timeMs)
  };
}
function compactPendingCursorTelemetryPauseRanges(ranges) {
  if (!pendingCursorRecordingData || ranges.length === 0) {
    return;
  }
  const normalizedRanges = ranges.map((range) => ({
    startMs: Math.max(0, Math.min(range.startMs, range.endMs)),
    endMs: Math.max(0, Math.max(range.startMs, range.endMs))
  })).filter((range) => Number.isFinite(range.startMs) && Number.isFinite(range.endMs)).filter((range) => range.endMs > range.startMs).sort((a, b) => a.startMs - b.startMs);
  if (normalizedRanges.length === 0) {
    return;
  }
  pendingCursorRecordingData = {
    ...pendingCursorRecordingData,
    samples: pendingCursorRecordingData.samples.map((sample) => {
      let pausedBeforeSampleMs = 0;
      for (const range of normalizedRanges) {
        if (sample.timeMs >= range.startMs && sample.timeMs <= range.endMs) {
          return null;
        }
        if (sample.timeMs > range.endMs) {
          pausedBeforeSampleMs += range.endMs - range.startMs;
        }
      }
      return {
        ...sample,
        timeMs: Math.max(0, sample.timeMs - pausedBeforeSampleMs)
      };
    }).filter((sample) => Boolean(sample)).sort((a, b) => a.timeMs - b.timeMs)
  };
}
function completeNativeMacCursorPauseRange(endMs = Date.now()) {
  if (nativeMacPauseStartedAtMs === null || nativeMacCursorRecordingStartMs <= 0) {
    return;
  }
  nativeMacPauseRanges.push({
    startMs: Math.max(0, nativeMacPauseStartedAtMs - nativeMacCursorRecordingStartMs),
    endMs: Math.max(0, endMs - nativeMacCursorRecordingStartMs)
  });
  nativeMacPauseStartedAtMs = null;
}
function completeNativeWindowsCursorPauseRange(endMs = Date.now()) {
  if (nativeWindowsPauseStartedAtMs === null || nativeWindowsCursorRecordingStartMs <= 0) {
    return;
  }
  nativeWindowsPauseRanges.push({
    startMs: Math.max(0, nativeWindowsPauseStartedAtMs - nativeWindowsCursorRecordingStartMs),
    endMs: Math.max(0, endMs - nativeWindowsCursorRecordingStartMs)
  });
  nativeWindowsPauseStartedAtMs = null;
}
function waitForNativeWindowsCaptureStart(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for native Windows capture to start"));
    }, 12e3);
    const onOutput = (chunk) => {
      nativeWindowsCaptureOutput += chunk.toString();
      if (nativeWindowsCaptureOutput.includes("Recording started")) {
        cleanup();
        resolve();
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code) => {
      cleanup();
      reject(
        new Error(
          nativeWindowsCaptureOutput.trim() || `Native Windows capture exited before recording started (code=${code ?? "unknown"})`
        )
      );
    };
    const cleanup = () => {
      clearTimeout(timer);
      proc.stdout.off("data", onOutput);
      proc.stderr.off("data", onOutput);
      proc.off("error", onError);
      proc.off("exit", onExit);
    };
    proc.stdout.on("data", onOutput);
    proc.stderr.on("data", onOutput);
    proc.once("error", onError);
    proc.once("exit", onExit);
  });
}
function waitForNativeWindowsCaptureStop(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      if (!proc.killed) {
        proc.kill();
      }
      reject(
        new Error(
          `Timed out waiting for native Windows capture to stop. Output path: ${nativeWindowsCaptureTargetPath ?? "unknown"}. Output: ${nativeWindowsCaptureOutput.trim()}`
        )
      );
    }, NATIVE_WINDOWS_CAPTURE_STOP_TIMEOUT_MS);
    const onOutput = (chunk) => {
      nativeWindowsCaptureOutput += chunk.toString();
    };
    const onClose = (code) => {
      cleanup();
      const match = nativeWindowsCaptureOutput.match(/Recording stopped\. Output path: (.+)/);
      if (match?.[1]) {
        resolve(match[1].trim());
        return;
      }
      if (code === 0 && nativeWindowsCaptureTargetPath) {
        resolve(nativeWindowsCaptureTargetPath);
        return;
      }
      reject(
        new Error(
          nativeWindowsCaptureOutput.trim() || `Native Windows capture exited with code=${code ?? "unknown"}`
        )
      );
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      proc.stdout.off("data", onOutput);
      proc.stderr.off("data", onOutput);
      proc.off("close", onClose);
      proc.off("error", onError);
    };
    proc.stdout.on("data", onOutput);
    proc.stderr.on("data", onOutput);
    proc.once("close", onClose);
    proc.once("error", onError);
  });
}
function readNativeWindowsWebcamFormat(output) {
  const lines = output.split(/\r?\n/).filter((line) => line.includes('"event":"webcam-format"'));
  const lastLine = lines.at(-1);
  if (!lastLine) {
    return null;
  }
  try {
    return JSON.parse(lastLine);
  } catch {
    return null;
  }
}
function tryParseNativeHelperEvent(line) {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function inspectNativeMacCaptureOutput() {
  for (const line of nativeMacCaptureOutput.split(/\r?\n/)) {
    const event = tryParseNativeHelperEvent(line.trim());
    if (event) {
      nativeMacCaptureEvents.emit("helper-event", event);
    }
  }
}
function attachNativeMacCaptureOutputDrain(proc) {
  let lineBuffer = "";
  const drain = (chunk) => {
    const text = chunk.toString();
    nativeMacCaptureOutput += text;
    lineBuffer += text;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = tryParseNativeHelperEvent(line.trim());
      if (event) {
        nativeMacCaptureEvents.emit("helper-event", event);
      }
    }
  };
  const cleanup = () => {
    proc.stdout.off("data", drain);
    proc.stderr.off("data", drain);
    proc.off("close", cleanup);
    proc.off("error", cleanup);
  };
  proc.stdout.on("data", drain);
  proc.stderr.on("data", drain);
  proc.once("close", cleanup);
  proc.once("error", cleanup);
}
function waitForNativeMacCaptureStart(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for native macOS capture to start"));
    }, 1e4);
    const inspect = (event) => {
      if (event.event === "recording-started") {
        cleanup();
        resolve();
        return;
      }
      if (event.event === "error") {
        cleanup();
        reject(new Error(String(event.message ?? event.code ?? "Native macOS capture failed")));
      }
    };
    const onOutput = (event) => inspect(event);
    const onClose = (code) => {
      cleanup();
      reject(
        new Error(
          nativeMacCaptureOutput.trim() || `Native macOS capture exited before recording started (code=${code ?? "unknown"})`
        )
      );
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      nativeMacCaptureEvents.off("helper-event", onOutput);
      proc.off("close", onClose);
      proc.off("error", onError);
    };
    nativeMacCaptureEvents.on("helper-event", onOutput);
    proc.once("close", onClose);
    proc.once("error", onError);
    inspectNativeMacCaptureOutput();
  });
}
function waitForNativeMacCaptureStop(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for native macOS capture to stop. Output path: ${nativeMacCaptureTargetPath ?? "unknown"}. Output: ${nativeMacCaptureOutput.trim()}`
        )
      );
    }, 3e4);
    const inspect = (event) => {
      if (event.event === "recording-stopped") {
        cleanup();
        resolve(String(event.screenPath ?? nativeMacCaptureTargetPath ?? ""));
        return;
      }
      if (event.event === "error") {
        cleanup();
        reject(new Error(String(event.message ?? event.code ?? "Native macOS capture failed")));
      }
    };
    const onOutput = (event) => inspect(event);
    const onClose = (code) => {
      if (code === 0 && nativeMacCaptureTargetPath) {
        cleanup();
        resolve(nativeMacCaptureTargetPath);
        return;
      }
      cleanup();
      reject(
        new Error(
          nativeMacCaptureOutput.trim() || `Native macOS capture exited with code=${code ?? "unknown"}`
        )
      );
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      nativeMacCaptureEvents.off("helper-event", onOutput);
      proc.off("close", onClose);
      proc.off("error", onError);
    };
    nativeMacCaptureEvents.on("helper-event", onOutput);
    proc.once("close", onClose);
    proc.once("error", onError);
    inspectNativeMacCaptureOutput();
  });
}
function setCurrentRecordingSessionState(session2) {
  currentRecordingSession = session2;
  currentVideoPath = session2?.screenVideoPath ?? null;
}
function getSessionManifestPathForVideo(videoPath) {
  const parsedPath = path.parse(videoPath);
  const baseName = parsedPath.name.endsWith("-webcam") ? parsedPath.name.slice(0, -"-webcam".length) : parsedPath.name;
  return path.join(parsedPath.dir, `${baseName}${RECORDING_SESSION_SUFFIX}`);
}
async function loadRecordedSessionForVideoPath(videoPath) {
  try {
    const manifestPath = getSessionManifestPathForVideo(videoPath);
    if (!isPathAllowed(manifestPath)) {
      const parsedVideoPath = path.parse(videoPath);
      if (!isPathWithinDir(path.resolve(manifestPath), parsedVideoPath.dir)) {
        return null;
      }
    }
    const content = await fs.readFile(manifestPath, "utf-8");
    const session2 = normalizeRecordingSession(JSON.parse(content));
    if (!session2) {
      return null;
    }
    const normalizedVideoPath = normalizePath(videoPath);
    const matchesScreen = normalizePath(session2.screenVideoPath) === normalizedVideoPath;
    const matchesWebcam = typeof session2.webcamVideoPath === "string" && normalizePath(session2.webcamVideoPath) === normalizedVideoPath;
    if (!matchesScreen && !matchesWebcam) {
      return null;
    }
    if (!isPathAllowed(session2.screenVideoPath)) {
      const approvedScreen = await approveReadableVideoPath(session2.screenVideoPath, [
        path.dirname(manifestPath),
        RECORDINGS_DIR
      ]);
      if (!approvedScreen) {
        return null;
      }
      session2.screenVideoPath = approvedScreen;
    }
    if (session2.webcamVideoPath && !isPathAllowed(session2.webcamVideoPath)) {
      const approvedWebcam = await approveReadableVideoPath(session2.webcamVideoPath, [
        path.dirname(manifestPath),
        RECORDINGS_DIR
      ]);
      if (!approvedWebcam) {
        session2.webcamVideoPath = void 0;
      } else {
        session2.webcamVideoPath = approvedWebcam;
      }
    }
    approveFilePath(session2.screenVideoPath);
    if (session2.webcamVideoPath) {
      approveFilePath(session2.webcamVideoPath);
    }
    return session2;
  } catch (error) {
    const nodeError = error;
    if (nodeError.code !== "ENOENT") {
      console.error("Failed to restore recording session manifest:", error);
    }
    return null;
  }
}
let screenCaptureAccessProbe = null;
function probeScreenCaptureAccess() {
  if (!screenCaptureAccessProbe) {
    screenCaptureAccessProbe = desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {
    }).then(() => {
      screenCaptureAccessProbe = null;
    });
  }
  return screenCaptureAccessProbe;
}
function registerIpcHandlers(createEditorWindow2, createSourceSelectorWindow2, createCountdownOverlayWindow2, getMainWindow, getSourceSelectorWindow, getCountdownOverlayWindow, onRecordingStateChange, _switchToHud) {
  async function requestScreenAccess() {
    if (process.platform !== "darwin") {
      return { success: true, granted: true, status: "granted" };
    }
    try {
      let status = systemPreferences.getMediaAccessStatus("screen");
      if (status === "granted") {
        return { success: true, granted: true, status };
      }
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        if (!mainWin.isVisible()) {
          mainWin.show();
        }
        mainWin.focus();
      }
      app.focus({ steal: true });
      await probeScreenCaptureAccess();
      status = systemPreferences.getMediaAccessStatus("screen");
      return { success: true, granted: status === "granted", status };
    } catch (error) {
      console.error("Failed to request screen access:", error);
      return { success: false, granted: false, status: "unknown", error: String(error) };
    }
  }
  ipcMain.handle("get-sources", async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    lastEnumeratedSources = new Map(sources.map((source) => [source.id, source]));
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });
  ipcMain.handle("select-source", async (_, source) => {
    selectedSource = source;
    selectedDesktopSource = typeof source.id === "string" ? lastEnumeratedSources.get(source.id) ?? null : null;
    if (!selectedDesktopSource && typeof source.id === "string") {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 0, height: 0 },
          fetchWindowIcons: true
        });
        lastEnumeratedSources = new Map(sources.map((candidate) => [candidate.id, candidate]));
        selectedDesktopSource = lastEnumeratedSources.get(source.id) ?? null;
      } catch {
        selectedDesktopSource = null;
      }
    }
    await persistSelectedSource(source);
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.close();
    }
    return selectedSource;
  });
  ipcMain.handle("get-selected-source", async () => {
    if (selectedSource) {
      return selectedSource;
    }
    return await restoreSelectedSource() ?? null;
  });
  ipcMain.handle("request-camera-access", async () => {
    if (process.platform !== "darwin") {
      return { success: true, granted: true, status: "granted" };
    }
    try {
      const status = systemPreferences.getMediaAccessStatus("camera");
      if (status === "granted") {
        return { success: true, granted: true, status };
      }
      if (status === "not-determined") {
        const granted = await systemPreferences.askForMediaAccess("camera");
        return {
          success: true,
          granted,
          status: granted ? "granted" : systemPreferences.getMediaAccessStatus("camera")
        };
      }
      return { success: true, granted: false, status };
    } catch (error) {
      console.error("Failed to request camera access:", error);
      return {
        success: false,
        granted: false,
        status: "unknown",
        error: String(error)
      };
    }
  });
  ipcMain.handle("request-screen-access", async () => {
    return requestScreenAccess();
  });
  ipcMain.handle("request-native-mac-cursor-access", async () => {
    const access = await requestMacCursorAccessibilityAccess();
    if (process.platform === "darwin" && !access.granted) {
      const mainWin = getMainWindow();
      const detail = access.status === "missing-helper" ? "The cursor helper couldn't be found in this build, so the editable cursor can't be enabled. Rebuild the native helper (pnpm run build:native:mac) or switch the HUD cursor mode to system." : "Allow OpenScreen under System Settings → Privacy & Security → Accessibility, then press record again to start the countdown.";
      const messageOptions = {
        type: "warning",
        buttons: ["Open Accessibility Settings", "Cancel"],
        defaultId: 0,
        cancelId: 1,
        message: "Accessibility access is required for the editable cursor",
        detail
      };
      const result = mainWin && !mainWin.isDestroyed() ? await dialog.showMessageBox(mainWin, messageOptions) : await dialog.showMessageBox(messageOptions);
      if (result.response === 0) {
        await shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        );
      }
    }
    return access;
  });
  ipcMain.handle("open-source-selector", async () => {
    const access = await requestScreenAccess();
    if (!access.granted) {
      if (process.platform === "darwin" && access.status !== "not-determined") {
        const mainWin = getMainWindow();
        let detail;
        if (app.isPackaged) {
          detail = "Allow OpenScreen in macOS System Settings, then quit and reopen this app and choose a screen or window.";
        } else {
          const electronAppBundlePath = path.dirname(path.dirname(path.dirname(process.execPath)));
          clipboard.writeText(electronAppBundlePath);
          detail = `Dev runs inherit this permission from the app that launched them. Open System Settings → Privacy & Security → Screen Recording and enable the app whose terminal you ran the dev server from (Visual Studio Code, Terminal, ...). Add it via "+" if it is missing, then fully quit and reopen that app and start the dev server again.
(Electron runtime path, already copied to the clipboard: ${electronAppBundlePath})`;
        }
        const messageOptions = {
          type: "warning",
          buttons: ["Open System Settings", "Cancel"],
          defaultId: 0,
          cancelId: 1,
          message: "Screen Recording permission is required",
          detail
        };
        const result = mainWin && !mainWin.isDestroyed() ? await dialog.showMessageBox(mainWin, messageOptions) : await dialog.showMessageBox(messageOptions);
        if (result.response === 0) {
          await shell.openExternal(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
          );
        }
      }
      return {
        opened: false,
        reason: "screen-access-required",
        access
      };
    }
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.focus();
      return { opened: true };
    }
    createSourceSelectorWindow2();
    return { opened: true };
  });
  ipcMain.handle("switch-to-editor", () => {
    createEditorWindow2();
  });
  ipcMain.handle("switch-to-hud", () => {
    _switchToHud?.();
    return { success: true };
  });
  ipcMain.handle("start-new-recording", () => {
    _switchToHud?.();
    return { success: true };
  });
  ipcMain.handle("countdown-overlay-show", async (_, value, runId) => {
    const overlayWindow = getCountdownOverlayWindow?.() ?? createCountdownOverlayWindow2();
    if (overlayWindow.isDestroyed()) {
      return;
    }
    if (overlayWindow.webContents.isLoading()) {
      await new Promise((resolve) => {
        overlayWindow.once("ready-to-show", resolve);
      });
    }
    if (!overlayWindow.isVisible()) {
      overlayWindow.showInactive();
    }
    overlayWindow.webContents.send("countdown-overlay-value", value, runId);
  });
  ipcMain.handle("countdown-overlay-set-value", (_, value, runId) => {
    const overlayWindow = getCountdownOverlayWindow?.();
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }
    overlayWindow.webContents.send("countdown-overlay-value", value, runId);
  });
  ipcMain.handle("countdown-overlay-hide", (_, runId) => {
    const overlayWindow = getCountdownOverlayWindow?.();
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }
    overlayWindow.webContents.send("countdown-overlay-value", null, runId);
    overlayWindow.hide();
  });
  ipcMain.handle("is-native-windows-capture-available", async () => {
    if (!isWindowsGraphicsCaptureOsSupported()) {
      return { success: true, available: false, reason: "unsupported-os" };
    }
    const helperPath = await findNativeWindowsCaptureHelperPath();
    return helperPath ? { success: true, available: true, helperPath } : { success: true, available: false, reason: "missing-helper" };
  });
  ipcMain.handle("is-native-mac-capture-available", async () => {
    if (process.platform !== "darwin") {
      return { success: true, available: false, reason: "unsupported-platform" };
    }
    const helperPath = await findNativeMacCaptureHelperPath();
    return helperPath ? { success: true, available: true, helperPath } : { success: true, available: false, reason: "missing-helper" };
  });
  ipcMain.handle(
    "start-native-windows-recording",
    async (_, request) => {
      try {
        if (!isWindowsGraphicsCaptureOsSupported()) {
          return {
            success: false,
            error: "Windows Graphics Capture requires Windows 10 build 19041 or newer."
          };
        }
        if (nativeWindowsCaptureProcess) {
          return { success: false, error: "Native Windows capture is already running." };
        }
        const helperPath = await findNativeWindowsCaptureHelperPath();
        if (!helperPath) {
          return { success: false, error: "Native Windows capture helper is not available." };
        }
        if (!request?.source?.sourceId) {
          return {
            success: false,
            error: "Native Windows capture request is missing a source."
          };
        }
        const recordingId = typeof request.recordingId === "number" && Number.isFinite(request.recordingId) ? request.recordingId : Date.now();
        const outputPath = path.join(RECORDINGS_DIR, `${RECORDING_FILE_PREFIX}${recordingId}.mp4`);
        const webcamOutputPath = path.join(
          RECORDINGS_DIR,
          `${RECORDING_FILE_PREFIX}${recordingId}-webcam.mp4`
        );
        const sourceDisplay = request.source.type === "display" && typeof request.source.displayId === "number" ? screen.getAllDisplays().find((display) => display.id === request.source.displayId) ?? null : getSelectedDisplay();
        const bounds = sourceDisplay?.bounds ?? getSelectedSourceBounds();
        const displayId = typeof request.source.displayId === "number" && Number.isFinite(request.source.displayId) ? request.source.displayId : Number(selectedSource?.display_id);
        const webcamDirectShowClsid = request.webcam.enabled ? await resolveDirectShowWebcamClsid(request.webcam.deviceName) : null;
        const cursorCaptureMode = normalizeCursorCaptureMode(request.cursor?.mode) ?? "editable-overlay";
        const config = {
          schemaVersion: 2,
          recordingId,
          outputPath,
          sourceType: request.source.type,
          sourceId: request.source.sourceId,
          displayId: Number.isFinite(displayId) ? displayId : 0,
          windowHandle: request.source.windowHandle ?? null,
          fps: request.video.fps,
          videoWidth: request.video.width,
          videoHeight: request.video.height,
          displayX: bounds.x,
          displayY: bounds.y,
          displayW: bounds.width,
          displayH: bounds.height,
          hasDisplayBounds: true,
          captureSystemAudio: request.audio.system.enabled,
          captureMic: request.audio.microphone.enabled,
          microphoneDeviceId: request.audio.microphone.deviceId ?? null,
          microphoneDeviceName: request.audio.microphone.deviceName ?? null,
          microphoneGain: request.audio.microphone.gain,
          webcamEnabled: request.webcam.enabled,
          webcamDeviceId: request.webcam.deviceId ?? null,
          webcamDeviceName: request.webcam.deviceName ?? null,
          webcamDirectShowClsid,
          webcamWidth: request.webcam.width,
          webcamHeight: request.webcam.height,
          webcamFps: request.webcam.fps,
          captureCursor: cursorCaptureMode === "system",
          cursorCaptureMode,
          outputs: {
            screenPath: outputPath,
            webcamPath: webcamOutputPath
          },
          source: {
            type: request.source.type,
            sourceId: request.source.sourceId,
            displayId: Number.isFinite(displayId) ? displayId : null,
            windowHandle: request.source.windowHandle ?? null,
            bounds
          },
          video: request.video,
          audio: request.audio,
          webcam: request.webcam,
          cursor: {
            mode: cursorCaptureMode
          }
        };
        console.info("[native-wgc] starting Windows capture", {
          helperPath,
          source: request.source,
          audio: request.audio,
          webcam: request.webcam,
          cursor: { mode: cursorCaptureMode },
          bounds,
          sourceId: selectedSource?.id ?? null,
          usedDisplayMatch: Boolean(sourceDisplay),
          outputPath
        });
        await fs.mkdir(RECORDINGS_DIR, { recursive: true });
        nativeWindowsCaptureOutput = "";
        nativeWindowsCaptureTargetPath = outputPath;
        nativeWindowsCaptureWebcamTargetPath = request.webcam.enabled ? webcamOutputPath : null;
        nativeWindowsCaptureRecordingId = recordingId;
        nativeWindowsCursorOffsetMs = 0;
        nativeWindowsCursorCaptureMode = cursorCaptureMode;
        nativeWindowsCursorRecordingStartMs = 0;
        nativeWindowsPauseStartedAtMs = null;
        nativeWindowsPauseRanges = [];
        nativeWindowsIsPaused = false;
        const cursorStartTimeMs = Date.now();
        if (cursorCaptureMode === "editable-overlay") {
          nativeWindowsCursorRecordingStartMs = cursorStartTimeMs;
          await startCursorRecording(cursorStartTimeMs);
          console.info("[native-wgc] cursor sampler ready", {
            cursorStartTimeMs,
            warmupMs: Date.now() - cursorStartTimeMs
          });
        } else {
          pendingCursorRecordingData = null;
        }
        const proc = spawn(helperPath, [JSON.stringify(config)], {
          cwd: RECORDINGS_DIR,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        });
        nativeWindowsCaptureProcess = proc;
        await waitForNativeWindowsCaptureStart(proc);
        const captureStartedAtMs = Date.now();
        nativeWindowsCursorOffsetMs = cursorCaptureMode === "editable-overlay" ? Math.max(0, captureStartedAtMs - cursorStartTimeMs) : 0;
        const webcamFormat = readNativeWindowsWebcamFormat(nativeWindowsCaptureOutput);
        console.info("[native-wgc] capture started", {
          captureStartedAtMs,
          cursorOffsetMs: nativeWindowsCursorOffsetMs,
          webcamFormat
        });
        const source = selectedSource || { name: "Screen" };
        if (onRecordingStateChange) {
          onRecordingStateChange(true, source.name);
        }
        return {
          success: true,
          recordingId,
          path: outputPath,
          helperPath
        };
      } catch (error) {
        console.error("Failed to start native Windows recording:", error);
        nativeWindowsCaptureProcess?.kill();
        nativeWindowsCaptureProcess = null;
        nativeWindowsCaptureTargetPath = null;
        nativeWindowsCaptureWebcamTargetPath = null;
        nativeWindowsCaptureRecordingId = null;
        nativeWindowsCursorOffsetMs = 0;
        nativeWindowsCursorCaptureMode = "editable-overlay";
        nativeWindowsCursorRecordingStartMs = 0;
        nativeWindowsPauseStartedAtMs = null;
        nativeWindowsPauseRanges = [];
        nativeWindowsIsPaused = false;
        await stopCursorRecording();
        return { success: false, error: String(error) };
      }
    }
  );
  ipcMain.handle("start-native-mac-recording", async (_, request) => {
    try {
      if (process.platform !== "darwin") {
        return { success: false, error: "Native macOS capture requires macOS." };
      }
      if (nativeMacCaptureProcess) {
        return { success: false, error: "Native macOS capture is already running." };
      }
      const helperPath = await findNativeMacCaptureHelperPath();
      if (!helperPath) {
        return { success: false, error: "Native macOS capture helper is not available." };
      }
      if (!request?.source?.sourceId) {
        return { success: false, error: "Native macOS capture request is missing a source." };
      }
      const recordingId = typeof request.recordingId === "number" && Number.isFinite(request.recordingId) ? request.recordingId : Date.now();
      const outputPath = path.join(RECORDINGS_DIR, `${RECORDING_FILE_PREFIX}${recordingId}.mp4`);
      const cursorCaptureMode = normalizeCursorCaptureMode(request.cursor?.mode) ?? "editable-overlay";
      try {
        await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 1, height: 1 }
        });
      } catch {
      }
      if (request.audio?.microphone?.enabled) {
        const micStatus = systemPreferences.getMediaAccessStatus("microphone");
        if (micStatus !== "granted") {
          await systemPreferences.askForMediaAccess("microphone");
        }
      }
      const sourceDisplay = request.source.type === "display" && typeof request.source.displayId === "number" ? screen.getAllDisplays().find((display) => display.id === request.source.displayId) ?? null : getSelectedDisplay();
      const bounds = request.source.bounds ?? sourceDisplay?.bounds ?? getSelectedSourceBounds();
      const config = {
        ...request,
        schemaVersion: 1,
        recordingId,
        source: {
          ...request.source,
          bounds
        },
        video: {
          ...request.video,
          hideSystemCursor: cursorCaptureMode === "editable-overlay"
        },
        webcam: {
          ...request.webcam,
          enabled: false
        },
        cursor: {
          mode: cursorCaptureMode
        },
        outputs: {
          screenPath: outputPath,
          manifestPath: path.join(
            RECORDINGS_DIR,
            `${RECORDING_FILE_PREFIX}${recordingId}${RECORDING_SESSION_SUFFIX}`
          )
        }
      };
      console.info("[native-sck] starting macOS capture", {
        helperPath,
        source: config.source,
        audio: config.audio,
        webcam: config.webcam,
        cursor: config.cursor,
        outputPath
      });
      await fs.mkdir(RECORDINGS_DIR, { recursive: true });
      nativeMacCaptureOutput = "";
      nativeMacCaptureTargetPath = outputPath;
      nativeMacCaptureRecordingId = recordingId;
      nativeMacCursorOffsetMs = 0;
      nativeMacCursorCaptureMode = cursorCaptureMode;
      nativeMacCursorRecordingStartMs = 0;
      nativeMacPauseStartedAtMs = null;
      nativeMacPauseRanges = [];
      nativeMacIsPaused = false;
      const cursorStartTimeMs = Date.now();
      if (cursorCaptureMode === "editable-overlay") {
        nativeMacCursorRecordingStartMs = cursorStartTimeMs;
        await startCursorRecording(cursorStartTimeMs);
      } else {
        pendingCursorRecordingData = null;
      }
      const proc = spawn(helperPath, [JSON.stringify(config)], {
        cwd: RECORDINGS_DIR,
        stdio: ["pipe", "pipe", "pipe"]
      });
      nativeMacCaptureProcess = proc;
      attachNativeMacCaptureOutputDrain(proc);
      await waitForNativeMacCaptureStart(proc);
      const captureStartedAtMs = Date.now();
      nativeMacCursorOffsetMs = cursorCaptureMode === "editable-overlay" ? Math.max(0, captureStartedAtMs - cursorStartTimeMs) : 0;
      const source = selectedSource || { name: "Screen" };
      if (onRecordingStateChange) {
        onRecordingStateChange(true, source.name);
      }
      return {
        success: true,
        recordingId,
        path: outputPath,
        helperPath
      };
    } catch (error) {
      console.error("Failed to start native macOS recording:", error);
      nativeMacCaptureProcess?.kill();
      nativeMacCaptureProcess = null;
      nativeMacCaptureTargetPath = null;
      nativeMacCaptureRecordingId = null;
      nativeMacCursorOffsetMs = 0;
      nativeMacCursorCaptureMode = "editable-overlay";
      nativeMacCursorRecordingStartMs = 0;
      nativeMacPauseStartedAtMs = null;
      nativeMacPauseRanges = [];
      nativeMacIsPaused = false;
      await stopCursorRecording();
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("pause-native-mac-recording", async () => {
    if (process.platform !== "darwin") {
      return { success: false, error: "Native macOS capture requires macOS." };
    }
    const proc = nativeMacCaptureProcess;
    if (!proc) {
      return { success: false, error: "Native macOS capture is not running." };
    }
    if (nativeMacIsPaused) {
      return { success: true };
    }
    if (!proc.stdin.writable) {
      return { success: false, error: "Native macOS capture command channel is closed." };
    }
    try {
      proc.stdin.write("pause\n");
      nativeMacIsPaused = true;
      nativeMacPauseStartedAtMs = Date.now();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("resume-native-mac-recording", async () => {
    if (process.platform !== "darwin") {
      return { success: false, error: "Native macOS capture requires macOS." };
    }
    const proc = nativeMacCaptureProcess;
    if (!proc) {
      return { success: false, error: "Native macOS capture is not running." };
    }
    if (!nativeMacIsPaused) {
      return { success: true };
    }
    if (!proc.stdin.writable) {
      return { success: false, error: "Native macOS capture command channel is closed." };
    }
    try {
      proc.stdin.write("resume\n");
      completeNativeMacCursorPauseRange();
      nativeMacIsPaused = false;
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("pause-native-windows-recording", async () => {
    const proc = nativeWindowsCaptureProcess;
    if (!proc) {
      return { success: false, error: "Native Windows capture is not running." };
    }
    if (nativeWindowsIsPaused) {
      return { success: true };
    }
    if (!proc.stdin.writable) {
      return { success: false, error: "Native Windows capture command channel is closed." };
    }
    try {
      proc.stdin.write("pause\n");
      nativeWindowsIsPaused = true;
      nativeWindowsPauseStartedAtMs = Date.now();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("resume-native-windows-recording", async () => {
    const proc = nativeWindowsCaptureProcess;
    if (!proc) {
      return { success: false, error: "Native Windows capture is not running." };
    }
    if (!nativeWindowsIsPaused) {
      return { success: true };
    }
    if (!proc.stdin.writable) {
      return { success: false, error: "Native Windows capture command channel is closed." };
    }
    try {
      proc.stdin.write("resume\n");
      completeNativeWindowsCursorPauseRange();
      nativeWindowsIsPaused = false;
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("stop-native-windows-recording", async (_, discard) => {
    const proc = nativeWindowsCaptureProcess;
    const preferredPath = nativeWindowsCaptureTargetPath;
    const preferredWebcamPath = nativeWindowsCaptureWebcamTargetPath;
    const recordingId = nativeWindowsCaptureRecordingId ?? Date.now();
    const cursorCaptureMode = nativeWindowsCursorCaptureMode;
    if (!proc) {
      return { success: false, error: "Native Windows capture is not running." };
    }
    try {
      completeNativeWindowsCursorPauseRange();
      const stoppedPathPromise = waitForNativeWindowsCaptureStop(proc);
      proc.stdin.write("stop\n");
      const stoppedPath = await stoppedPathPromise;
      const screenVideoPath = stoppedPath || preferredPath;
      if (!screenVideoPath) {
        throw new Error("Native Windows capture did not return an output path.");
      }
      if (cursorCaptureMode === "editable-overlay") {
        await stopCursorRecording();
      } else {
        pendingCursorRecordingData = null;
      }
      if (discard) {
        pendingCursorRecordingData = null;
        await Promise.all([
          fs.rm(screenVideoPath, { force: true }),
          preferredWebcamPath ? fs.rm(preferredWebcamPath, { force: true }) : Promise.resolve(),
          fs.rm(`${screenVideoPath}.cursor.json`, { force: true })
        ]);
        return { success: true, discarded: true };
      }
      if (cursorCaptureMode === "editable-overlay") {
        compactPendingCursorTelemetryPauseRanges(nativeWindowsPauseRanges);
        shiftPendingCursorTelemetry(nativeWindowsCursorOffsetMs);
        await writePendingCursorTelemetry(screenVideoPath);
      }
      let webcamVideoPath;
      if (preferredWebcamPath) {
        try {
          await fs.access(preferredWebcamPath, constants.R_OK);
          webcamVideoPath = preferredWebcamPath;
        } catch {
          webcamVideoPath = void 0;
        }
      }
      const session2 = webcamVideoPath ? { screenVideoPath, webcamVideoPath, createdAt: recordingId, cursorCaptureMode } : { screenVideoPath, createdAt: recordingId, cursorCaptureMode };
      setCurrentRecordingSessionState(session2);
      currentProjectPath = null;
      const sessionManifestPath = path.join(
        RECORDINGS_DIR,
        `${path.parse(screenVideoPath).name}${RECORDING_SESSION_SUFFIX}`
      );
      await fs.writeFile(sessionManifestPath, JSON.stringify(session2, null, 2), "utf-8");
      return {
        success: true,
        path: screenVideoPath,
        session: session2,
        message: "Native Windows recording session stored successfully"
      };
    } catch (error) {
      console.error("Failed to stop native Windows recording:", error);
      await stopCursorRecording();
      return { success: false, error: String(error) };
    } finally {
      nativeWindowsCaptureProcess = null;
      nativeWindowsCaptureTargetPath = null;
      nativeWindowsCaptureWebcamTargetPath = null;
      nativeWindowsCaptureRecordingId = null;
      nativeWindowsCursorOffsetMs = 0;
      nativeWindowsCursorCaptureMode = "editable-overlay";
      nativeWindowsCursorRecordingStartMs = 0;
      nativeWindowsPauseStartedAtMs = null;
      nativeWindowsPauseRanges = [];
      nativeWindowsIsPaused = false;
      const source = selectedSource || { name: "Screen" };
      if (onRecordingStateChange) {
        onRecordingStateChange(false, source.name);
      }
    }
  });
  ipcMain.handle("stop-native-mac-recording", async (_, discard) => {
    if (process.platform !== "darwin") {
      return { success: false, error: "Native macOS capture requires macOS." };
    }
    const proc = nativeMacCaptureProcess;
    const preferredPath = nativeMacCaptureTargetPath;
    const recordingId = nativeMacCaptureRecordingId ?? Date.now();
    const cursorCaptureMode = nativeMacCursorCaptureMode;
    if (!proc) {
      return { success: false, error: "Native macOS capture is not running." };
    }
    try {
      completeNativeMacCursorPauseRange();
      const stoppedPathPromise = waitForNativeMacCaptureStop(proc);
      proc.stdin.write("stop\n");
      const stoppedPath = await stoppedPathPromise;
      const screenVideoPath = stoppedPath || preferredPath;
      if (!screenVideoPath) {
        throw new Error("Native macOS capture did not return an output path.");
      }
      if (cursorCaptureMode === "editable-overlay") {
        await stopCursorRecording();
      } else {
        pendingCursorRecordingData = null;
      }
      if (discard) {
        pendingCursorRecordingData = null;
        await Promise.all([
          fs.rm(screenVideoPath, { force: true }),
          fs.rm(`${screenVideoPath}.cursor.json`, { force: true })
        ]);
        return { success: true, discarded: true };
      }
      if (cursorCaptureMode === "editable-overlay") {
        compactPendingCursorTelemetryPauseRanges(nativeMacPauseRanges);
        shiftPendingCursorTelemetry(nativeMacCursorOffsetMs);
        await writePendingCursorTelemetry(screenVideoPath);
      }
      const session2 = {
        screenVideoPath,
        createdAt: recordingId,
        cursorCaptureMode
      };
      setCurrentRecordingSessionState(session2);
      currentProjectPath = null;
      const sessionManifestPath = path.join(
        RECORDINGS_DIR,
        `${path.parse(screenVideoPath).name}${RECORDING_SESSION_SUFFIX}`
      );
      await fs.writeFile(sessionManifestPath, JSON.stringify(session2, null, 2), "utf-8");
      return {
        success: true,
        path: screenVideoPath,
        session: session2,
        message: "Native macOS recording session stored successfully"
      };
    } catch (error) {
      console.error("Failed to stop native macOS recording:", error);
      await stopCursorRecording();
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      nativeMacCaptureProcess = null;
      nativeMacCaptureTargetPath = null;
      nativeMacCaptureRecordingId = null;
      nativeMacCursorOffsetMs = 0;
      nativeMacCursorCaptureMode = "editable-overlay";
      nativeMacCursorRecordingStartMs = 0;
      nativeMacPauseStartedAtMs = null;
      nativeMacPauseRanges = [];
      nativeMacIsPaused = false;
      const source = selectedSource || { name: "Screen" };
      if (onRecordingStateChange) {
        onRecordingStateChange(false, source.name);
      }
    }
  });
  ipcMain.handle(
    "attach-native-mac-webcam-recording",
    async (_, payload) => {
      try {
        if (process.platform !== "darwin") {
          return { success: false, error: "Native macOS webcam attachment requires macOS." };
        }
        const screenVideoPath = normalizeVideoSourcePath(payload.screenVideoPath);
        if (!screenVideoPath || !isPathWithinDir(screenVideoPath, RECORDINGS_DIR)) {
          return {
            success: false,
            error: "Native macOS webcam attachment requires a recording output path."
          };
        }
        await fs.access(screenVideoPath, constants.R_OK);
        if (!payload.webcam?.fileName || !payload.webcam.videoData) {
          return { success: false, error: "Native macOS webcam attachment is missing video data." };
        }
        const webcamVideoPath = resolveRecordingOutputPath(payload.webcam.fileName);
        await fs.writeFile(webcamVideoPath, Buffer.from(payload.webcam.videoData));
        const createdAt = typeof payload.recordingId === "number" && Number.isFinite(payload.recordingId) ? payload.recordingId : Date.now();
        const cursorCaptureMode = normalizeCursorCaptureMode(payload.cursorCaptureMode);
        const session2 = {
          screenVideoPath,
          webcamVideoPath,
          createdAt,
          ...cursorCaptureMode ? { cursorCaptureMode } : {}
        };
        setCurrentRecordingSessionState(session2);
        currentProjectPath = null;
        const sessionManifestPath = path.join(
          RECORDINGS_DIR,
          `${path.parse(screenVideoPath).name}${RECORDING_SESSION_SUFFIX}`
        );
        await fs.writeFile(sessionManifestPath, JSON.stringify(session2, null, 2), "utf-8");
        return {
          success: true,
          path: screenVideoPath,
          session: session2,
          message: "Native macOS webcam recording attached successfully"
        };
      } catch (error) {
        console.error("Failed to attach native macOS webcam recording:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  );
  const recordingStreams = new RecordingStreamRegistry();
  registerRecordingStreamHandlers(ipcMain, recordingStreams, resolveRecordingOutputPath);
  ipcMain.handle("store-recorded-session", async (_, payload) => {
    try {
      return await storeRecordedSessionFiles(payload);
    } catch (error) {
      console.error("Failed to store recording session:", error);
      return {
        success: false,
        message: "Failed to store recording session",
        error: String(error)
      };
    }
  });
  async function storeRecordedSessionFiles(payload) {
    const createdAt = typeof payload.createdAt === "number" && Number.isFinite(payload.createdAt) ? payload.createdAt : Date.now();
    const cursorCaptureMode = normalizeCursorCaptureMode(payload.cursorCaptureMode);
    const screenVideoPath = resolveRecordingOutputPath(payload.screen.fileName);
    const screenStreamed = await finalizeRecordingFile(
      recordingStreams,
      payload.screen.fileName,
      screenVideoPath,
      payload.screen.videoData
    );
    let webcamVideoPath;
    let webcamStreamed = false;
    if (payload.webcam) {
      webcamVideoPath = resolveRecordingOutputPath(payload.webcam.fileName);
      webcamStreamed = await finalizeRecordingFile(
        recordingStreams,
        payload.webcam.fileName,
        webcamVideoPath,
        payload.webcam.videoData
      );
    }
    if (isValidDurationMs(payload.durationMs)) {
      const patches = [];
      if (screenStreamed) {
        patches.push(patchWebmDurationOnDisk(screenVideoPath, payload.durationMs));
      }
      if (webcamStreamed && webcamVideoPath) {
        patches.push(patchWebmDurationOnDisk(webcamVideoPath, payload.durationMs));
      }
      await Promise.all(patches);
    }
    const session2 = webcamVideoPath ? {
      screenVideoPath,
      webcamVideoPath,
      createdAt,
      ...cursorCaptureMode ? { cursorCaptureMode } : {}
    } : { screenVideoPath, createdAt, ...cursorCaptureMode ? { cursorCaptureMode } : {} };
    setCurrentRecordingSessionState(session2);
    currentProjectPath = null;
    await writePendingCursorTelemetry(screenVideoPath);
    const sessionManifestPath = path.join(
      RECORDINGS_DIR,
      `${path.parse(payload.screen.fileName).name}${RECORDING_SESSION_SUFFIX}`
    );
    await fs.writeFile(sessionManifestPath, JSON.stringify(session2, null, 2), "utf-8");
    return {
      success: true,
      path: screenVideoPath,
      session: session2,
      message: "Recording session stored successfully"
    };
  }
  ipcMain.handle("store-recorded-video", async (_, videoData, fileName) => {
    try {
      return await storeRecordedSessionFiles({
        screen: { videoData, fileName },
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Failed to store recorded video:", error);
      return {
        success: false,
        message: "Failed to store recorded video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("get-recorded-video-path", async () => {
    try {
      if (currentRecordingSession?.screenVideoPath) {
        return { success: true, path: currentRecordingSession.screenVideoPath };
      }
      const files = await fs.readdir(RECORDINGS_DIR);
      const videoFiles = files.filter(
        (file) => file.endsWith(".webm") && !file.endsWith("-webcam.webm")
      );
      if (videoFiles.length === 0) {
        return { success: false, message: "No recorded video found" };
      }
      const latestVideo = videoFiles.sort().reverse()[0];
      const videoPath = path.join(RECORDINGS_DIR, latestVideo);
      return { success: true, path: videoPath };
    } catch (error) {
      console.error("Failed to get video path:", error);
      return { success: false, message: "Failed to get video path", error: String(error) };
    }
  });
  ipcMain.handle("list-recorded-sessions", async () => {
    try {
      await fs.mkdir(RECORDINGS_DIR, { recursive: true });
      const entries = await fs.readdir(RECORDINGS_DIR);
      const sessions = [];
      for (const entry of entries) {
        if (!entry.endsWith(RECORDING_SESSION_SUFFIX)) continue;
        let session2 = null;
        try {
          const content = await fs.readFile(path.join(RECORDINGS_DIR, entry), "utf-8");
          session2 = normalizeRecordingSession(JSON.parse(content));
        } catch {
          continue;
        }
        if (!session2) continue;
        const screenVideoPath = session2.screenVideoPath;
        let screenVideoBytes = 0;
        try {
          const stat = await fs.stat(screenVideoPath);
          if (!stat.isFile()) continue;
          screenVideoBytes = stat.size;
        } catch {
          continue;
        }
        let webcamVideoPath;
        if (session2.webcamVideoPath) {
          try {
            const webcamStat = await fs.stat(session2.webcamVideoPath);
            if (webcamStat.isFile()) {
              webcamVideoPath = session2.webcamVideoPath;
            }
          } catch {
          }
        }
        sessions.push({
          screenVideoPath,
          ...webcamVideoPath ? { webcamVideoPath } : {},
          ...session2.cursorCaptureMode ? { cursorCaptureMode: session2.cursorCaptureMode } : {},
          createdAt: session2.createdAt,
          screenVideoBytes
        });
      }
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      return { success: true, sessions };
    } catch (error) {
      console.error("Failed to list recorded sessions:", error);
      return { success: false, message: "Failed to list recordings", error: String(error) };
    }
  });
  ipcMain.handle(
    "rename-recorded-session",
    async (_, screenVideoPath, rawName) => {
      try {
        let name;
        if (typeof rawName === "string") {
          name = rawName.replace(/[\u0000-\u001f<>:/\\"|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
        }
        const manifestPath = getSessionManifestPathForVideo(screenVideoPath);
        if (!manifestPath || !isPathWithinDir(manifestPath, RECORDINGS_DIR)) {
          return { success: false, message: "Not a recording in the recordings directory" };
        }
        let session2 = null;
        try {
          const content = await fs.readFile(manifestPath, "utf-8");
          session2 = normalizeRecordingSession(JSON.parse(content));
        } catch {
          session2 = null;
        }
        if (!session2) {
          return { success: false, message: "Session manifest not found or invalid" };
        }
        const next = { ...session2 };
        if (name) {
          next.name = name;
        } else {
          delete next.name;
        }
        await fs.writeFile(manifestPath, JSON.stringify(next, null, 2), "utf-8");
        if (currentRecordingSession?.screenVideoPath && path.resolve(currentRecordingSession.screenVideoPath) === path.resolve(screenVideoPath)) {
          setCurrentRecordingSessionState(next);
        }
        return { success: true, session: next };
      } catch (error) {
        console.error("Failed to rename recording session:", error);
        return {
          success: false,
          message: "Failed to rename recording session",
          error: String(error)
        };
      }
    }
  );
  ipcMain.handle(
    "set-recording-state",
    async (_, recording, recordingId, cursorCaptureMode) => {
      const normalizedCursorCaptureMode = normalizeCursorCaptureMode(cursorCaptureMode) ?? "editable-overlay";
      if (recording && normalizedCursorCaptureMode === "editable-overlay") {
        await startCursorRecording(recordingId);
      } else {
        await stopCursorRecording();
      }
      const source = selectedSource || { name: "Screen" };
      if (onRecordingStateChange) {
        onRecordingStateChange(recording, source.name);
      }
    }
  );
  ipcMain.handle("get-cursor-telemetry", async (_, videoPath) => {
    const targetVideoPath = resolveApprovedVideoPath(
      videoPath ?? currentRecordingSession?.screenVideoPath
    );
    if (!targetVideoPath) {
      return { success: true, samples: [] };
    }
    return readCursorTelemetryFile(targetVideoPath);
  });
  ipcMain.handle("open-external-url", async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open URL:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("get-asset-base-path", () => {
    return resolveAssetBasePath();
  });
  ipcMain.handle("pick-export-save-path", async (_, fileName, exportFolder) => {
    try {
      const isGif = fileName.toLowerCase().endsWith(".gif");
      const filters = isGif ? [{ name: mainT("dialogs", "fileDialogs.gifImage"), extensions: ["gif"] }] : [{ name: mainT("dialogs", "fileDialogs.mp4Video"), extensions: ["mp4"] }];
      let defaultDir = app.getPath("downloads");
      if (exportFolder) {
        try {
          const stats = await fs.stat(exportFolder);
          if (stats.isDirectory()) {
            defaultDir = exportFolder;
          }
        } catch (err) {
          console.warn(
            `Could not access remembered export folder "${exportFolder}", falling back to Downloads:`,
            err
          );
        }
      }
      const dialogOptions = buildDialogOptions(
        {
          title: isGif ? mainT("dialogs", "fileDialogs.saveGif") : mainT("dialogs", "fileDialogs.saveVideo"),
          defaultPath: path.join(defaultDir, fileName),
          filters,
          properties: ["createDirectory", "showOverwriteConfirmation"]
        },
        getMainWindow()
      );
      const result = await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true, message: "Export canceled" };
      }
      return { success: true, path: path.normalize(result.filePath) };
    } catch (error) {
      console.error("Failed to show save dialog:", error);
      return {
        success: false,
        message: "Failed to show save dialog",
        error: String(error)
      };
    }
  });
  ipcMain.handle("write-export-to-path", async (_, videoData, filePath) => {
    try {
      if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
        return { success: false, message: "Invalid path" };
      }
      const lower = filePath.toLowerCase();
      if (!lower.endsWith(".mp4") && !lower.endsWith(".gif")) {
        return { success: false, message: "Invalid file type" };
      }
      const normalizedPath = path.normalize(filePath);
      await fs.mkdir(path.dirname(normalizedPath), { recursive: true });
      await fs.writeFile(normalizedPath, Buffer.from(videoData));
      return {
        success: true,
        path: normalizedPath,
        message: "Video exported successfully"
      };
    } catch (error) {
      console.error("Failed to write exported video:", error);
      return {
        success: false,
        message: "Failed to save exported video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("open-video-file-picker", async (_event, options) => {
    try {
      const multiple = options?.multiple === true;
      const properties = multiple ? ["openFile", "multiSelections"] : ["openFile"];
      const dialogOptions = buildDialogOptions(
        {
          title: mainT("dialogs", "fileDialogs.selectVideo"),
          defaultPath: RECORDINGS_DIR,
          filters: [
            {
              name: mainT("dialogs", "fileDialogs.videoFiles"),
              extensions: ALLOWED_IMPORT_VIDEO_EXTENSIONS_LIST
            },
            { name: mainT("dialogs", "fileDialogs.allFiles"), extensions: ["*"] }
          ],
          properties
        },
        getMainWindow()
      );
      const result = await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      const normalizedPaths = [];
      for (const filePath of result.filePaths) {
        const normalizedPath = await approveReadableVideoPath(filePath);
        if (!normalizedPath) {
          return {
            success: false,
            message: "Selected file is not a supported readable video file"
          };
        }
        normalizedPaths.push(normalizedPath);
      }
      currentProjectPath = null;
      return {
        success: true,
        path: normalizedPaths[0],
        paths: multiple ? normalizedPaths : void 0
      };
    } catch (error) {
      console.error("Failed to open file picker:", error);
      return {
        success: false,
        message: "Failed to open file picker",
        error: String(error)
      };
    }
  });
  ipcMain.handle("approve-video-file-paths", async (_, filePaths) => {
    try {
      if (!Array.isArray(filePaths) || filePaths.some((p) => typeof p !== "string")) {
        return { success: false, message: "Invalid paths" };
      }
      const approved = [];
      const rejected = [];
      for (const filePath of filePaths) {
        const normalizedPath = await approveReadableVideoPath(filePath);
        if (normalizedPath) {
          approved.push(normalizedPath);
        } else {
          rejected.push(path.resolve(filePath));
        }
      }
      return { success: true, approved, rejected };
    } catch (error) {
      console.error("Failed to approve video file paths:", error);
      return {
        success: false,
        message: "Failed to approve video file paths",
        error: String(error)
      };
    }
  });
  ipcMain.handle("reveal-in-folder", async (_, filePath) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error(`Error revealing item in folder: ${filePath}`, error);
      try {
        const openPathResult = await shell.openPath(path.dirname(filePath));
        if (openPathResult) {
          return { success: false, error: openPathResult };
        }
        return { success: true, message: "Could not reveal item, but opened directory." };
      } catch (openError) {
        console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
        return { success: false, error: String(error) };
      }
    }
  });
  ipcMain.handle("read-binary-file", async (_, filePath) => {
    try {
      const normalizedPath = await approveReadableVideoPath(filePath);
      if (!normalizedPath) {
        return {
          success: false,
          message: "File path is not approved or is not a supported video file"
        };
      }
      const data = await fs.readFile(normalizedPath);
      return {
        success: true,
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        path: normalizedPath
      };
    } catch (error) {
      console.error("Failed to read binary file:", error);
      return {
        success: false,
        message: "Failed to read binary file",
        error: String(error)
      };
    }
  });
  ipcMain.handle("prepare-preview-audio-track", async (_, filePath) => {
    try {
      return await prepareSupplementalPreviewAudioTrack(filePath);
    } catch (error) {
      console.error("Failed to prepare preview audio track:", error);
      return {
        success: false,
        message: "Failed to prepare preview audio track",
        error: String(error)
      };
    }
  });
  ipcMain.handle(
    "save-project-file",
    async (_, projectData, suggestedName, existingProjectPath) => {
      return saveProjectFile(projectData, suggestedName, existingProjectPath);
    }
  );
  ipcMain.handle(
    "save-project-file-silent",
    async (_, projectData, targetPath) => {
      try {
        if (!targetPath || typeof targetPath !== "string") {
          return { success: false, message: "Invalid target path" };
        }
        if (path.extname(targetPath).toLowerCase() !== `.${PROJECT_FILE_EXTENSION}`) {
          return { success: false, message: "Not an Openscreen project file" };
        }
        if (!isPathWithinDir(targetPath, RECORDINGS_DIR)) {
          return {
            success: false,
            message: "Silent saves are restricted to the recordings directory"
          };
        }
        const resolvedTarget = path.resolve(targetPath);
        await fs.writeFile(resolvedTarget, JSON.stringify(projectData, null, 2), "utf-8");
        currentProjectPath = resolvedTarget;
        return { success: true, path: resolvedTarget, message: "Project saved successfully" };
      } catch (error) {
        console.error("Failed to silently save project file:", error);
        return { success: false, message: "Failed to save project file", error: String(error) };
      }
    }
  );
  async function saveProjectFile(projectData, suggestedName, existingProjectPath) {
    try {
      const trustedExistingProjectPath = isTrustedProjectPath(existingProjectPath) ? existingProjectPath : null;
      if (trustedExistingProjectPath) {
        await fs.writeFile(
          trustedExistingProjectPath,
          JSON.stringify(projectData, null, 2),
          "utf-8"
        );
        currentProjectPath = trustedExistingProjectPath;
        return {
          success: true,
          path: trustedExistingProjectPath,
          message: "Project saved successfully"
        };
      }
      const safeName = (suggestedName || `project-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, "_");
      const defaultName = safeName.endsWith(`.${PROJECT_FILE_EXTENSION}`) ? safeName : `${safeName}.${PROJECT_FILE_EXTENSION}`;
      const dialogOptions = buildDialogOptions(
        {
          title: mainT("dialogs", "fileDialogs.saveProject"),
          defaultPath: path.join(RECORDINGS_DIR, defaultName),
          filters: [
            {
              name: mainT("dialogs", "fileDialogs.openscreenProject"),
              extensions: [PROJECT_FILE_EXTENSION]
            },
            { name: "JSON", extensions: ["json"] }
          ],
          properties: ["createDirectory", "showOverwriteConfirmation"]
        },
        getMainWindow()
      );
      const result = await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
          message: "Save project canceled"
        };
      }
      await fs.writeFile(result.filePath, JSON.stringify(projectData, null, 2), "utf-8");
      currentProjectPath = result.filePath;
      return {
        success: true,
        path: result.filePath,
        message: "Project saved successfully"
      };
    } catch (error) {
      console.error("Failed to save project file:", error);
      return {
        success: false,
        message: "Failed to save project file",
        error: String(error)
      };
    }
  }
  ipcMain.handle("load-project-file", async (_, projectFolder) => {
    return loadProjectFile(projectFolder);
  });
  async function loadProjectFile(projectFolder) {
    try {
      let defaultDir = RECORDINGS_DIR;
      if (projectFolder) {
        try {
          const stats = await fs.stat(projectFolder);
          if (stats.isDirectory()) {
            defaultDir = projectFolder;
          }
        } catch (err) {
          console.warn(
            `Could not access remembered project folder "${projectFolder}", falling back to RECORDINGS_DIR:`,
            err
          );
        }
      }
      const dialogOptions = buildDialogOptions(
        {
          title: mainT("dialogs", "fileDialogs.openProject"),
          defaultPath: defaultDir,
          filters: [
            {
              name: mainT("dialogs", "fileDialogs.openscreenProject"),
              extensions: [PROJECT_FILE_EXTENSION]
            },
            { name: "JSON", extensions: ["json"] },
            { name: mainT("dialogs", "fileDialogs.allFiles"), extensions: ["*"] }
          ],
          properties: ["openFile"]
        },
        getMainWindow()
      );
      const result = await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, message: "Open project canceled" };
      }
      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, "utf-8");
      const project = JSON.parse(content);
      currentProjectPath = filePath;
      setCurrentRecordingSessionState(await getApprovedProjectSession(project, filePath));
      return {
        success: true,
        path: filePath,
        project
      };
    } catch (error) {
      console.error("Failed to load project file:", error);
      return {
        success: false,
        message: "Failed to load project file",
        error: String(error)
      };
    }
  }
  ipcMain.handle("load-project-file-from-path", async (_event, filePath) => {
    return loadProjectFileFromPath(filePath);
  });
  async function loadProjectFileFromPath(filePath) {
    try {
      if (!filePath || typeof filePath !== "string") {
        return { success: false, message: "Invalid file path" };
      }
      if (path.extname(filePath).toLowerCase() !== `.${PROJECT_FILE_EXTENSION}`) {
        return { success: false, message: "Not an Openscreen project file" };
      }
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats?.isFile()) {
        return { success: false, message: "File not found" };
      }
      const content = await fs.readFile(filePath, "utf-8");
      const project = JSON.parse(content);
      currentProjectPath = filePath;
      let session2 = null;
      try {
        session2 = await getApprovedProjectSession(project, filePath);
      } catch (sessionError) {
        console.warn(
          "[loadProjectFileFromPath] Could not approve session paths, proceeding without session:",
          sessionError
        );
      }
      setCurrentRecordingSessionState(session2);
      return { success: true, path: filePath, project };
    } catch (error) {
      console.error("Failed to load project file from path:", error);
      return {
        success: false,
        message: "Failed to load project file",
        error: String(error)
      };
    }
  }
  ipcMain.handle("load-current-project-file", async () => {
    return loadCurrentProjectFile();
  });
  async function loadCurrentProjectFile() {
    try {
      if (!currentProjectPath) {
        return { success: false, message: "No active project" };
      }
      const content = await fs.readFile(currentProjectPath, "utf-8");
      const project = JSON.parse(content);
      setCurrentRecordingSessionState(await getApprovedProjectSession(project, currentProjectPath));
      return {
        success: true,
        path: currentProjectPath,
        project
      };
    } catch (error) {
      console.error("Failed to load current project file:", error);
      return {
        success: false,
        message: "Failed to load current project file",
        error: String(error)
      };
    }
  }
  ipcMain.handle("set-current-video-path", async (_, path2) => {
    return setCurrentVideoPath(path2);
  });
  ipcMain.handle("set-current-recording-session", (_, session2) => {
    const normalizedSession = normalizeRecordingSession(session2);
    setCurrentRecordingSessionState(normalizedSession);
    currentVideoPath = normalizedSession?.screenVideoPath ?? null;
    currentProjectPath = null;
    return { success: true, session: currentRecordingSession };
  });
  ipcMain.handle("get-current-recording-session", () => {
    return currentRecordingSession ? { success: true, session: currentRecordingSession } : { success: false };
  });
  async function setCurrentVideoPath(path2) {
    const normalizedPath = normalizeVideoSourcePath(path2);
    if (!normalizedPath || !isPathAllowed(normalizedPath)) {
      return {
        success: false,
        message: "Video path has not been approved"
      };
    }
    const restoredSession = await loadRecordedSessionForVideoPath(normalizedPath);
    if (restoredSession) {
      setCurrentRecordingSessionState(restoredSession);
    } else {
      setCurrentRecordingSessionState({
        screenVideoPath: normalizedPath,
        createdAt: Date.now()
      });
    }
    currentProjectPath = null;
    return { success: true, path: currentVideoPath ?? normalizedPath };
  }
  ipcMain.handle("get-current-video-path", () => {
    return getCurrentVideoPathResult();
  });
  function getCurrentVideoPathResult() {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  }
  ipcMain.handle("clear-current-video-path", () => {
    return clearCurrentVideoPath();
  });
  function clearCurrentVideoPath() {
    currentVideoPath = null;
    currentProjectPath = null;
    setCurrentRecordingSessionState(null);
    return { success: true };
  }
  ipcMain.handle("get-platform", () => {
    return process.platform;
  });
  ipcMain.handle("get-shortcuts", async () => {
    try {
      const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  });
  ipcMain.handle("save-shortcuts", async (_, shortcuts) => {
    try {
      await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      console.error("Failed to save shortcuts:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle(
    "save-diagnostic",
    async (_, payload) => {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Save Diagnostic File",
        defaultPath: `openscreen-diagnostic-${Date.now()}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      const diagnostic = {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        appVersion: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        osVersion: os.version(),
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        error: payload.error,
        stack: payload.stack,
        projectState: payload.projectState,
        recentLogs: payload.logs
      };
      try {
        await fs.writeFile(filePath, JSON.stringify(diagnostic, null, 2), "utf-8");
        return { success: true, path: filePath };
      } catch (error) {
        console.error("Failed to write diagnostic file:", error);
        return { success: false, error: String(error) };
      }
    }
  );
  registerNativeBridgeHandlers({
    getPlatform: () => process.platform,
    getCurrentProjectPath: () => currentProjectPath,
    getCurrentVideoPath: () => currentVideoPath,
    saveProjectFile,
    loadProjectFile,
    loadCurrentProjectFile,
    loadProjectFileFromPath,
    setCurrentVideoPath,
    getCurrentVideoPathResult,
    clearCurrentVideoPath,
    resolveAssetBasePath,
    resolveVideoPath: (videoPath) => normalizeVideoSourcePath(videoPath ?? currentVideoPath),
    loadCursorRecordingData: readCursorRecordingFile,
    loadCursorTelemetry: readCursorTelemetryFile
  });
}
const DEFAULT_OPEN_APP_BINDING = { key: "o", ctrl: true, shift: true };
const KEY_TO_ACCELERATOR = {
  " ": "Space",
  "+": "Plus",
  "-": "numsub",
  "*": "nummult",
  "/": "numdiv",
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  escape: "Escape",
  enter: "Return",
  backspace: "Backspace",
  delete: "Delete",
  tab: "Tab"
};
function bindingToAccelerator(binding) {
  const parts = [];
  if (binding.ctrl) parts.push("CommandOrControl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  const keyLower = binding.key.toLowerCase();
  const acceleratorKey = KEY_TO_ACCELERATOR[keyLower] ?? binding.key.toUpperCase();
  parts.push(acceleratorKey);
  return parts.join("+");
}
let currentAccelerator = null;
function registerOpenAppShortcut(binding, onTrigger) {
  const accelerator = bindingToAccelerator(binding);
  if (accelerator === currentAccelerator) {
    return true;
  }
  const success = globalShortcut.register(accelerator, onTrigger);
  if (success) {
    if (currentAccelerator) {
      globalShortcut.unregister(currentAccelerator);
    }
    currentAccelerator = accelerator;
    console.log(`Global shortcut registered: ${accelerator}`);
  } else {
    console.warn(`Failed to register global shortcut: ${accelerator}`);
  }
  return success;
}
async function loadAndRegisterGlobalShortcut(onTrigger) {
  try {
    const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
    const shortcuts = JSON.parse(data);
    const binding = shortcuts.openApp || DEFAULT_OPEN_APP_BINDING;
    registerOpenAppShortcut(binding, onTrigger);
  } catch {
    registerOpenAppShortcut(DEFAULT_OPEN_APP_BINDING, onTrigger);
  }
}
function unregisterAllGlobalShortcuts() {
  globalShortcut.unregisterAll();
}
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname$2, "..");
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST$1 = path.join(APP_ROOT, "dist");
const HEADLESS = process.env["HEADLESS"] === "true";
const ASSET_BASE_DIR = process.defaultApp ? path.join(__dirname$2, "..", "public") : process.resourcesPath;
const ASSET_BASE_URL_ARG = `--asset-base-url=${pathToFileURL(`${ASSET_BASE_DIR}${path.sep}`).toString()}`;
let hudOverlayWindow = null;
ipcMain.on("hud-overlay-hide", () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});
ipcMain.on("hud-overlay-ignore-mouse-events", (_event, ignore) => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});
ipcMain.on("hud-overlay-move-by", (_event, deltaX, deltaY) => {
  if (!hudOverlayWindow || hudOverlayWindow.isDestroyed() || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return;
  }
  const [x, y] = hudOverlayWindow.getPosition();
  hudOverlayWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY), false);
});
ipcMain.on("hud-overlay-set-size", (_event, width, height) => {
  if (!hudOverlayWindow || hudOverlayWindow.isDestroyed() || !Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }
  const bounds = hudOverlayWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  const nextWidth = Math.min(workArea.width, Math.max(1, Math.round(width)));
  const nextHeight = Math.min(workArea.height, Math.max(1, Math.round(height)));
  if (bounds.width === nextWidth && bounds.height === nextHeight) {
    return;
  }
  const centerX = bounds.x + bounds.width / 2;
  const bottomY = bounds.y + bounds.height;
  hudOverlayWindow.setBounds({
    x: Math.round(centerX - nextWidth / 2),
    y: Math.round(bottomY - nextHeight),
    width: nextWidth,
    height: nextHeight
  });
});
function createHudOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const windowWidth = 600;
  const windowHeight = 160;
  const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
  const y = Math.floor(workArea.y + workArea.height - windowHeight - 5);
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    // Min/max are intentionally loose: the renderer resizes to fit content via
    // "hud-overlay-set-size" (above), needed for the vertical tray to grow taller.
    minWidth: 120,
    minHeight: 80,
    x,
    y,
    frame: false,
    transparent: true,
    // Fully-transparent ARGB backing. Without this macOS draws the window as a
    // rounded glass panel with a border around the HUD content.
    backgroundColor: "#00000000",
    // Don't let macOS mask the window into a rounded rect; the HUD bar provides
    // its own rounding and the window itself must be invisible.
    roundedCorners: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    // shown via ready-to-show to avoid black rectangle flash
    webPreferences: {
      preload: path.join(__dirname$2, "preload.mjs"),
      additionalArguments: [ASSET_BASE_URL_ARG],
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.once("ready-to-show", () => {
    if (!HEADLESS) win.show();
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  hudOverlayWindow = win;
  win.on("closed", () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
  }
  return win;
}
function createEditorWindow() {
  const isMac2 = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...isMac2 && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "OpenScreen",
    backgroundColor: "#09090b",
    show: false,
    // shown via ready-to-show to avoid white flash on first load
    webPreferences: {
      preload: path.join(__dirname$2, "preload.mjs"),
      additionalArguments: [ASSET_BASE_URL_ARG],
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });
  win.maximize();
  win.once("ready-to-show", () => {
    if (!HEADLESS) win.show();
  });
  win.webContents.on("dom-ready", () => {
    win.webContents.insertCSS("html, body, #root { background: #09090b !important; }").catch(() => {
    });
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "editor" }
    });
  }
  return win;
}
function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname$2, "preload.mjs"),
      additionalArguments: [ASSET_BASE_URL_ARG],
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return win;
}
function createCountdownOverlayWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const overlayWidth = 420;
  const overlayHeight = 260;
  const win = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    minWidth: overlayWidth,
    maxWidth: overlayWidth,
    minHeight: overlayHeight,
    maxHeight: overlayHeight,
    x: Math.round(workArea.x + (workArea.width - overlayWidth) / 2),
    y: Math.round(workArea.y + (workArea.height - overlayHeight) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname$2, "preload.mjs"),
      additionalArguments: [ASSET_BASE_URL_ARG],
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.setIgnoreMouseEvents(true);
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=countdown-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "countdown-overlay" }
    });
  }
  return win;
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
if (process.platform === "darwin") {
  app.commandLine.appendSwitch("disable-features", "MacCatapLoopbackAudioForScreenShare");
}
if (process.platform === "linux") {
  const isWayland = process.env.XDG_SESSION_TYPE === "wayland" || process.env.WAYLAND_DISPLAY !== void 0;
  if (isWayland) {
    app.commandLine.appendSwitch("ozone-platform", "wayland");
    app.commandLine.appendSwitch("enable-features", "WaylandWindowDrag,WebRTCPipeWireCapturer");
  }
}
const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");
async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
    console.log("User Data Path:", app.getPath("userData"));
  } catch (error) {
    console.error("Failed to create recordings directory:", error);
  }
}
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
let countdownOverlayWindow = null;
let tray = null;
let selectedSourceName = "";
const isMac = process.platform === "darwin";
const trayIconSize = isMac ? 16 : 24;
const defaultTrayIcon = getTrayIcon("openscreen.png", trayIconSize);
const recordingTrayIcon = getTrayIcon("rec-button.png", trayIconSize);
function createWindow() {
  mainWindow = createHudOverlayWindow();
}
function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}
function isEditorWindow(window2) {
  return window2.webContents.getURL().includes("windowType=editor");
}
function sendEditorMenuAction(channel) {
  let targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed() || !isEditorWindow(targetWindow)) {
    createEditorWindowWrapper();
    targetWindow = mainWindow;
    if (!targetWindow || targetWindow.isDestroyed()) return;
    targetWindow.webContents.once("did-finish-load", () => {
      if (!targetWindow || targetWindow.isDestroyed()) return;
      targetWindow.webContents.send(channel);
    });
    return;
  }
  targetWindow.webContents.send(channel);
}
function setupApplicationMenu() {
  const isMac2 = process.platform === "darwin";
  const template = [];
  if (isMac2) {
    template.push({
      label: app.name,
      submenu: [
        {
          role: "about",
          label: mainT("common", "actions.about") || "About OpenScreen"
        },
        { type: "separator" },
        {
          role: "services",
          label: mainT("common", "actions.services") || "Services"
        },
        { type: "separator" },
        {
          role: "hide",
          label: mainT("common", "actions.hide") || "Hide OpenScreen"
        },
        {
          role: "hideOthers",
          label: mainT("common", "actions.hideOthers") || "Hide Others"
        },
        {
          role: "unhide",
          label: mainT("common", "actions.unhide") || "Show All"
        },
        { type: "separator" },
        { role: "quit", label: mainT("common", "actions.quit") || "Quit" }
      ]
    });
  }
  template.push(
    {
      label: mainT("common", "actions.file") || "File",
      submenu: [
        {
          label: mainT("dialogs", "unsavedChanges.newProject") || "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => sendEditorMenuAction("menu-new-project")
        },
        { type: "separator" },
        {
          label: mainT("dialogs", "unsavedChanges.loadProject") || "Load Project…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendEditorMenuAction("menu-load-project")
        },
        {
          label: mainT("dialogs", "unsavedChanges.saveProject") || "Save Project…",
          accelerator: "CmdOrCtrl+S",
          click: () => sendEditorMenuAction("menu-save-project")
        },
        {
          label: mainT("dialogs", "unsavedChanges.saveProjectAs") || "Save Project As…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendEditorMenuAction("menu-save-project-as")
        },
        ...isMac2 ? [] : [
          { type: "separator" },
          {
            role: "quit",
            label: mainT("common", "actions.quit") || "Quit"
          }
        ]
      ]
    },
    {
      label: mainT("common", "actions.edit") || "Edit",
      submenu: [
        { role: "undo", label: mainT("common", "actions.undo") || "Undo" },
        { role: "redo", label: mainT("common", "actions.redo") || "Redo" },
        { type: "separator" },
        { role: "cut", label: mainT("common", "actions.cut") || "Cut" },
        { role: "copy", label: mainT("common", "actions.copy") || "Copy" },
        { role: "paste", label: mainT("common", "actions.paste") || "Paste" },
        {
          role: "selectAll",
          label: mainT("common", "actions.selectAll") || "Select All"
        }
      ]
    },
    {
      label: mainT("common", "actions.view") || "View",
      submenu: [
        {
          role: "reload",
          label: mainT("common", "actions.reload") || "Reload"
        },
        {
          role: "forceReload",
          label: mainT("common", "actions.forceReload") || "Force Reload"
        },
        {
          role: "toggleDevTools",
          label: mainT("common", "actions.toggleDevTools") || "Toggle Developer Tools"
        },
        { type: "separator" },
        {
          role: "resetZoom",
          label: mainT("common", "actions.actualSize") || "Actual Size"
        },
        {
          role: "zoomIn",
          label: mainT("common", "actions.zoomIn") || "Zoom In"
        },
        {
          role: "zoomOut",
          label: mainT("common", "actions.zoomOut") || "Zoom Out"
        },
        { type: "separator" },
        {
          role: "togglefullscreen",
          label: mainT("common", "actions.toggleFullScreen") || "Toggle Full Screen"
        }
      ]
    },
    {
      label: mainT("common", "actions.window") || "Window",
      submenu: isMac2 ? [
        {
          role: "minimize",
          label: mainT("common", "actions.minimize") || "Minimize"
        },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" }
      ] : [
        {
          role: "minimize",
          label: mainT("common", "actions.minimize") || "Minimize"
        },
        {
          role: "close",
          label: mainT("common", "actions.close") || "Close"
        }
      ]
    }
  );
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
function createTray() {
  tray = new Tray(defaultTrayIcon);
  tray.on("click", () => {
    showMainWindow();
  });
  tray.on("double-click", () => {
    showMainWindow();
  });
}
function getTrayIcon(filename, size) {
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
    width: size,
    height: size,
    quality: "best"
  });
}
function updateTrayMenu(recording = false) {
  if (!tray) return;
  const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
  const trayToolTip = recording ? mainT("common", "actions.recordingStatus", {
    source: selectedSourceName
  }) || `Recording: ${selectedSourceName}` : "OpenScreen";
  const menuTemplate = recording ? [
    {
      label: mainT("common", "actions.stopRecording") || "Stop Recording",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stop-recording-from-tray");
        }
      }
    }
  ] : [
    {
      label: mainT("common", "actions.open") || "Open",
      click: () => {
        showMainWindow();
      }
    },
    {
      label: mainT("common", "actions.quit") || "Quit",
      click: () => {
        app.quit();
      }
    }
  ];
  tray.setImage(trayIcon);
  tray.setToolTip(trayToolTip);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}
let editorHasUnsavedChanges = false;
let isForceClosing = false;
let isCloseConfirmInFlight = false;
let isQuitting = false;
ipcMain.on("set-has-unsaved-changes", (_, hasChanges) => {
  editorHasUnsavedChanges = hasChanges;
});
function forceCloseEditorWindow(windowToClose) {
  if (!windowToClose || windowToClose.isDestroyed()) return;
  isForceClosing = true;
  setImmediate(() => {
    try {
      if (!windowToClose.isDestroyed()) {
        windowToClose.close();
      }
    } finally {
      isForceClosing = false;
    }
  });
}
function createEditorWindowWrapper() {
  if (mainWindow) {
    isForceClosing = true;
    mainWindow.close();
    isForceClosing = false;
    mainWindow = null;
  }
  mainWindow = createEditorWindow();
  editorHasUnsavedChanges = false;
  mainWindow.on("closed", () => {
    editorHasUnsavedChanges = false;
  });
  mainWindow.on("close", (event) => {
    if (isForceClosing || !editorHasUnsavedChanges || isCloseConfirmInFlight) return;
    event.preventDefault();
    isCloseConfirmInFlight = true;
    const windowToClose = mainWindow;
    if (!windowToClose || windowToClose.isDestroyed()) return;
    windowToClose.webContents.send("request-close-confirm");
    ipcMain.once("close-confirm-response", (event2, choice) => {
      if (event2.sender.id !== windowToClose?.webContents.id) return;
      isCloseConfirmInFlight = false;
      if (!windowToClose || windowToClose.isDestroyed()) return;
      if (choice === "save") {
        windowToClose.webContents.send("request-save-before-close");
        ipcMain.once("save-before-close-done", (event3, shouldClose) => {
          if (event3.sender.id !== windowToClose?.webContents.id) return;
          if (!shouldClose) return;
          forceCloseEditorWindow(windowToClose);
        });
      } else if (choice === "discard") {
        forceCloseEditorWindow(windowToClose);
      }
    });
  });
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
function createCountdownOverlayWindowWrapper() {
  if (countdownOverlayWindow && !countdownOverlayWindow.isDestroyed()) {
    return countdownOverlayWindow;
  }
  countdownOverlayWindow = createCountdownOverlayWindow();
  countdownOverlayWindow.on("closed", () => {
    countdownOverlayWindow = null;
  });
  return countdownOverlayWindow;
}
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("window-all-closed", () => {
  if (isQuitting) return;
  showMainWindow();
});
app.on("activate", () => {
  const hasVisibleWindow = BrowserWindow.getAllWindows().some((window2) => {
    if (window2.isDestroyed() || !window2.isVisible()) {
      return false;
    }
    const url = window2.webContents.getURL();
    const isCountdownOverlayWindow = url.includes("windowType=countdown-overlay");
    return !isCountdownOverlayWindow;
  });
  if (!hasVisibleWindow) {
    showMainWindow();
  }
});
app.on("will-quit", () => {
  unregisterAllGlobalShortcuts();
});
app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    app.dock?.show();
  }
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = [
      "media",
      "audioCapture",
      "microphone",
      "videoCapture",
      "camera",
      "screen",
      "display-capture"
    ];
    return allowed.includes(permission);
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = [
      "media",
      "audioCapture",
      "microphone",
      "videoCapture",
      "camera",
      "screen",
      "display-capture"
    ];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      const source = getSelectedDesktopSource();
      if (!request.videoRequested || !source) {
        callback({});
        return;
      }
      callback({
        video: source,
        ...request.audioRequested && process.platform === "win32" ? { audio: "loopback" } : {}
      });
    },
    { useSystemPicker: false }
  );
  if (process.platform === "darwin") {
    const micStatus = systemPreferences.getMediaAccessStatus("microphone");
    if (micStatus !== "granted") {
      await systemPreferences.askForMediaAccess("microphone");
    }
  }
  ipcMain.on("hud-overlay-close", () => {
    app.quit();
  });
  ipcMain.handle("set-locale", (_, locale2) => {
    setMainLocale(locale2);
    setupApplicationMenu();
    updateTrayMenu();
  });
  ipcMain.handle("update-global-shortcut", (_, binding) => {
    const success = registerOpenAppShortcut(binding, showMainWindow);
    return { success };
  });
  createTray();
  updateTrayMenu();
  setupApplicationMenu();
  await ensureRecordingsDir();
  function switchToHudWrapper() {
    if (mainWindow) {
      isForceClosing = true;
      mainWindow.close();
      isForceClosing = false;
      mainWindow = null;
    }
    showMainWindow();
  }
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    createCountdownOverlayWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    () => countdownOverlayWindow,
    (recording, sourceName) => {
      selectedSourceName = sourceName;
      if (!tray) createTray();
      updateTrayMenu(recording);
      if (!recording) {
        showMainWindow();
      }
    },
    switchToHudWrapper
  );
  await loadAndRegisterGlobalShortcut(showMainWindow);
  createWindow();
});
export {
  MAIN_DIST,
  RECORDINGS_DIR,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};

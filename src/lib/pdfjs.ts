import * as pdfjsLib from "pdfjs-dist";
import workerMjs from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import workerJs from "pdfjs-dist/build/pdf.worker.min.js?url";

// Single source of truth for pdf.js worker configuration (Vite-friendly)
// Avoid any CDN dependency; worker is bundled and served locally.
// Prefer .mjs (pdfjs v4), but keep .js as compatibility fallback.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerMjs || workerJs;

export const pdfjsWorkerSrcs = { workerMjs, workerJs };
export { pdfjsLib };

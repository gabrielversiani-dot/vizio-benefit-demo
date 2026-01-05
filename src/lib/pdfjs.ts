import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Single source of truth for pdf.js worker configuration (Vite-friendly)
// Avoid any CDN dependency; worker is bundled and served locally.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjsLib };

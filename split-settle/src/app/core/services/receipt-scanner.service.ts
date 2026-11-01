import { Injectable } from "@angular/core";
import { parseReceiptText, ParsedReceipt } from "../utils/receipt-parse";

export type ScanStage = "preparing" | "reading";

const MAX_PIXELS = 4_000_000;

/** Reads receipts with Tesseract running in a web worker; the photo never leaves the device. */
@Injectable({
  providedIn: "root",
})
export class ReceiptScannerService {
  async scan(
    file: Blob,
    onProgress: (stage: ScanStage, fraction: number) => void,
    signal: AbortSignal,
  ): Promise<ParsedReceipt> {
    // Tesseract's terminate() leaves pending jobs unsettled, so every await races against cancellation
    const cancelled = new Promise<never>((_, reject) => {
      const fail = () => reject(new DOMException("Scan cancelled", "AbortError"));
      if (signal.aborted) {
        fail();
      } else {
        signal.addEventListener("abort", fail, { once: true });
      }
    });
    cancelled.catch(() => undefined);

    const { default: Tesseract } = await Promise.race([
      import("tesseract.js/dist/tesseract.esm.min.js"),
      cancelled,
    ]);
    // Served from our own origin (copied from node_modules at build time, see angular.json)
    const base = document.baseURI;
    const workerReady = Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
      workerPath: new URL("ocr/worker.min.js", base).href,
      corePath: new URL("ocr/core", base).href,
      langPath: new URL("ocr/lang", base).href,
      logger: (m) =>
        onProgress(m.status === "recognizing text" ? "reading" : "preparing", m.progress),
      errorHandler: () => undefined,
    });
    try {
      const image = await Promise.race([prepareImage(file), cancelled]);
      const worker = await Promise.race([workerReady, cancelled]);
      const { data } = await Promise.race([worker.recognize(image), cancelled]);
      return parseReceiptText(data.text);
    } finally {
      void workerReady.then((w) => w.terminate(), () => undefined);
    }
  }
}

/** Downscales big photos (faster OCR) and boosts contrast for faded thermal prints. */
async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available");
  }
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { MOCK_LLM, PORT } from "./config.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";
import cvRouter from "./routes.ts";
import { closeBrowser } from "./services/pdfBuilder.ts";

/**
 * UYGULAMANIN GİRİŞ NOKTASI.
 *
 * Buradaki tek iş "montaj": parçaları doğru SIRAYLA birleştirmek.
 * Express'te sıra kritiktir — istek, tanımlandıkları sırayla middleware'lerden
 * geçer. Örneğin JSON ayrıştırıcı route'lardan ÖNCE gelmezse `req.body`
 * undefined olur; hata işleyici en SONA gelmezse hiçbir hatayı yakalayamaz.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// 1) Gövde ayrıştırma. LLM istekleri uzun metin taşıdığı için varsayılan
//    100kb limitini yükseltiyoruz; ama sınırsız bırakmıyoruz (bellek koruması).
app.use(express.json({ limit: "1mb" }));

// 2) Statik dosyalar: public/ altındaki arayüz.
app.use(express.static(path.join(__dirname, "..", "public")));

// 3) API route'ları. "/api" ön eki, statik dosyalarla isim çakışmasını önler.
app.use("/api", cvRouter);

// 4) Hiçbiri eşleşmediyse 404.
app.use(notFoundHandler);

// 5) Hata işleyici EN SONDA. Express, 4 parametreli fonksiyonu hata
//    işleyici olarak tanır ve zincirdeki tüm hataları buraya yönlendirir.
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`✓ Resume Tailor çalışıyor:  http://localhost:${PORT}`);
  if (MOCK_LLM) {
    console.log("  ⚠  MOCK_LLM=true — Gemini'ye istek atılmıyor, sahte CV üretiliyor.");
  }
});

/**
 * ZARİF KAPANIŞ (graceful shutdown).
 *
 * Puppeteer ayrı bir Chromium SÜRECİ başlatır. Node kapanırken onu
 * kapatmazsak arka planda öksüz süreçler birikir ve RAM'i yer.
 * Ctrl+C (SIGINT) ve süreç yöneticisinden gelen SIGTERM'i yakalayıp
 * önce yeni bağlantıları durdurur, sonra tarayıcıyı kapatırız.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} alındı, kapatılıyor...`);
  server.close();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

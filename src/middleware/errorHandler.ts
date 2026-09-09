import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.ts";

/**
 * MIDDLEWARE NEDİR?
 * Express'te bir istek, route handler'a varmadan önce bir dizi fonksiyondan
 * geçer. Her biri isteği okuyabilir, değiştirebilir, sonlandırabilir veya
 * `next()` diyerek sıradakine devredebilir. İşte bu ara katman fonksiyonlarına
 * middleware denir. Kimlik doğrulama, loglama, gövde ayrıştırma hep buradadır.
 *
 * HATA MIDDLEWARE'İ ise özeldir: Express, DÖRT parametreli
 * (err, req, res, next) fonksiyonları hata işleyici olarak tanır. Zincirin
 * herhangi bir yerinde fırlatılan hata doğrudan buraya düşer.
 *
 * Express 5 ile birlikte `async` handler'ların reddettiği (reject) promise'ler
 * de otomatik olarak buraya gelir — Express 4'te her handler'ı try/catch ile
 * sarmak ya da bir sarmalayıcı yazmak gerekiyordu.
 */

/** Hiçbir route eşleşmediyse: 404. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Bulunamadı: ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // 1) Girdi doğrulama hatası → 400, alan alan açıklama ile.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Gönderilen veri geçersiz.",
      details: err.issues.map((i) => ({
        field: i.path.join(".") || "(gövde)",
        message: i.message,
      })),
    });
    return;
  }

  // 2) Bizim bilinçli olarak fırlattığımız hatalar → kendi status kodlarıyla.
  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error(`[${err.name}]`, err.message, err.cause ?? "");
    res.status(err.statusCode).json({
      error: err.expose ? err.message : "Sunucu hatası.",
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 3) Beklenmeyen her şey → 500 ve GENEL mesaj.
  // Hatanın içeriği loglanır ama İSTEMCİYE SIZDIRILMAZ: stack trace'ler,
  // dosya yolları ve bağımlılık isimleri saldırgana bilgi verir.
  console.error("[UnhandledError]", err);
  res.status(500).json({ error: "Beklenmeyen bir sunucu hatası oluştu." });
};

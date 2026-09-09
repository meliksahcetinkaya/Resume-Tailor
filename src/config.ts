import "dotenv/config";

/**
 * Tüm ortam değişkeni okuması TEK yerde yapılır.
 *
 * Neden? Çünkü `process.env.X` çağrısını koda serpiştirirsen:
 *  - hangi değişkenlerin gerektiğini görmek için tüm projeyi taraman gerekir,
 *  - eksik bir anahtar kendini ancak o kod yolu çalıştığında (yani kullanıcı
 *    "CV Oluştur"a bastığında) belli eder.
 *
 * Bunun yerine burada "fail-fast" yaparız: yanlış yapılandırma varsa sunucu
 * hiç ayağa kalkmaz. Hatayı 3 saniyede görürsün, 3 dakika sonra değil.
 */

function readFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Ortam değişkeni ${name} sayı olmalı, gelen: "${raw}"`);
  }
  return parsed;
}

/**
 * MOCK_LLM=true iken Gemini'ye hiç istek atılmaz, sabit bir örnek CV döner.
 * Böylece arayüzü/PDF'i/Word'ü geliştirirken ücretsiz kotayı yakmazsın.
 */
export const MOCK_LLM = readFlag("MOCK_LLM", false);

export const PORT = readNumber("PORT", 3000);

/** Gemini model adı. Tek yerden değiştirilebilsin diye burada. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

const apiKey = process.env.GOOGLE_API_KEY?.trim() ?? "";

if (!MOCK_LLM && !apiKey) {
  throw new Error(
    "GOOGLE_API_KEY tanımlı değil.\n" +
      "  → .env.example dosyasını .env olarak kopyalayıp anahtarını yaz, veya\n" +
      "  → LLM olmadan denemek için .env içine MOCK_LLM=true ekle.",
  );
}

export const GOOGLE_API_KEY = apiKey;

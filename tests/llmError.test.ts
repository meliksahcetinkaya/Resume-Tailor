import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Hata mesajı eşlemesinin testi.
 *
 * Neden değerli? Bu proje geliştirilirken Gemini defalarca 503 döndürdü
 * ve mesaj her seferinde "API anahtarını kontrol et" dedi — sorun
 * anahtarda olmadığı hâlde. Yanlış mesaj, yanlış yerde arama demek.
 * Bu test o karışıklığın geri gelmemesini garanti eder.
 *
 * MOCK_LLM=true ile çalıştırılır: llm.ts import edildiğinde config.ts
 * çalışır ve anahtar yoksa fail-fast yapardı; test ortamında anahtar yok.
 */
process.env.MOCK_LLM = "true";
const { llmErrorFor } = await import("../src/services/llm.ts");

describe("llmErrorFor", () => {
  it("401/403 için anahtarı işaret eder", () => {
    for (const status of [401, 403]) {
      assert.match(llmErrorFor(status).message, /GOOGLE_API_KEY/);
    }
  });

  it("404 için model adını işaret eder", () => {
    assert.match(llmErrorFor(404).message, /GEMINI_MODEL/);
  });

  it("429 için kotayı işaret eder", () => {
    assert.match(llmErrorFor(429).message, /Kota/i);
  });

  /** Asıl regresyon testi: 503, anahtarı suçlamamalı. */
  it("503 için yoğunluğu söyler, anahtarı suçlamaz", () => {
    const message = llmErrorFor(503).message;
    assert.match(message, /yoğun/i);
    assert.ok(!/GOOGLE_API_KEY/.test(message), "503 mesajı anahtardan söz etmemeli");
  });

  it("5xx ailesinin tamamı aynı mesajı verir", () => {
    const base = llmErrorFor(503).message;
    for (const status of [500, 502, 504]) {
      assert.equal(llmErrorFor(status).message, base);
    }
  });

  it("tüm hatalar 502 statüsüyle dışarı çıkar", () => {
    for (const status of [400, 401, 404, 429, 503, 0]) {
      assert.equal(llmErrorFor(status).statusCode, 502);
    }
  });
});

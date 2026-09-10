import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { GEMINI_MODEL, GOOGLE_API_KEY, MOCK_LLM } from "../config.ts";
import { LlmError } from "../errors.ts";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompts.ts";
import { CVDataSchema, type CVData } from "../schemas/cvSchema.ts";
import type { Profile } from "../schemas/requestSchema.ts";
import type { z } from "zod";
import { AnalysisSchema, type Analysis } from "../schemas/analysisSchema.ts";
import { LetterDataSchema, type LetterData } from "../schemas/letterSchema.ts";
import {
  ANALYSIS_SYSTEM_PROMPT,
  LETTER_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildLetterPrompt,
} from "../prompts.ts";
import { buildMockCv, buildMockAnalysis, buildMockLetter } from "./mockData.ts";

/**
 * Gemini ile konuşan TEK yer.
 *
 * Bu dosya HTTP bilmez: `req`/`res` görmez, status kodu döndürmez.
 * Girdisi düz veri, çıktısı düz veri. Bu sayede Express'i ayağa kaldırmadan
 * test edilebilir ve yarın Gemini'yi başka bir modelle değiştirmek istersen
 * sadece burası değişir.
 */

const stringArray: Schema = { type: Type.ARRAY, items: { type: Type.STRING } };

/**
 * Gemini'ye "çıktıyı şu biçimde üret" demek için kullanılan şema.
 *
 * Neden Zod şemasını otomatik çevirmiyoruz? Çünkü Gemini, JSON Schema'nın
 * kısıtlı bir alt kümesini kabul eder ve `zod-to-json-schema`'nın ürettiği
 * `$ref` / `additionalProperties` gibi anahtarları reddeder. Bu yüzden
 * iki şema, iki ayrı iş yapar:
 *   - buradaki şema  → modele BİÇİM tarif eder (yönlendirme),
 *   - CVDataSchema   → gelen çıktıyı DOĞRULAR ve normalize eder (güvenlik).
 * Son söz her zaman Zod'undur; buradaki bir eksiklik sessizce geçmez, hata olur.
 */
const GEMINI_CV_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Adayın tam adı" },
    headerLines: {
      ...stringArray,
      description: "Adın altındaki unvan satırları, örn. ['Backend Developer']",
    },
    contactLines: {
      ...stringArray,
      description: "E-posta, telefon, LinkedIn, şehir gibi iletişim satırları",
    },
    summary: {
      type: Type.STRING,
      description: "İlana doğrudan hitap eden 2-4 cümlelik profesyonel özet",
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING },
          institution: { type: Type.STRING },
          location: { type: Type.STRING, description: "Bilinmiyorsa boş string" },
          dates: { type: Type.STRING, description: "Serbest metin, örn. '2018 – 2022'" },
        },
        required: ["degree", "institution", "location", "dates"],
      },
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING, description: "Bilinmiyorsa boş string" },
          dates: { type: Type.STRING },
          bullets: {
            ...stringArray,
            description: "Eylem fiiliyle başlayan 2-5 madde; her biri tek cümle",
          },
        },
        required: ["title", "company", "location", "dates", "bullets"],
      },
    },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          tech: { ...stringArray, description: "Kullanılan teknolojiler" },
        },
        required: ["title", "description", "tech"],
      },
    },
    skillCategories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "örn. 'Diller', 'Frameworkler'" },
          items: stringArray,
        },
        required: ["category", "items"],
      },
    },
    languages: { ...stringArray, description: "örn. ['Türkçe (Ana dil)', 'İngilizce (B2)']" },
    additionalSections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING, description: "örn. 'Sertifikalar'" },
          items: stringArray,
        },
        required: ["heading", "items"],
      },
    },
  },
  required: [
    "name",
    "headerLines",
    "contactLines",
    "summary",
    "education",
    "experience",
    "projects",
    "skillCategories",
    "languages",
    "additionalSections",
  ],
  // CV'nin okunma sırası; modelin alanları bu sırayla üretmesini teşvik eder.
  propertyOrdering: [
    "name",
    "headerLines",
    "contactLines",
    "summary",
    "experience",
    "projects",
    "education",
    "skillCategories",
    "languages",
    "additionalSections",
  ],
};

/**
 * Client'ı tembel (lazy) kuruyoruz.
 * Neden? MOCK_LLM modunda API anahtarı yok; modül import edilir edilmez
 * client kurmaya kalksaydık mock mod anahtarsız çalışmazdı.
 */
let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  return client;
}

/**
 * Adayın ham profilinden, verilen iş ilanına uyarlanmış CV verisini üretir.
 *
 * Neden `async`? Ağ üzerinden bir modele istek atıyoruz; bu işlem saniyeler
 * sürebilir. Senkron olsaydı Node'un tek iş parçacıklı olay döngüsü bu süre
 * boyunca bloke olur ve sunucu başka HİÇBİR isteğe cevap veremezdi.
 */
export async function generateCv(profile: Profile, jobPosting: string): Promise<CVData> {
  if (MOCK_LLM) {
    return buildMockCv(profile);
  }

  let rawText: string | undefined;
  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: buildUserPrompt(profile, jobPosting),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Bu ikili birlikte "structured output" demek: modelin serbest metin
        // yerine şemaya uyan saf JSON üretmesi garanti altına alınır.
        responseMimeType: "application/json",
        responseSchema: GEMINI_CV_SCHEMA,
        // Düşük sıcaklık: CV'de yaratıcılıktan çok tutarlılık ve olgulara
        // sadakat istiyoruz. Yüksek değerler uydurma riskini artırır.
        temperature: 0.4,
      },
    });
    rawText = response.text;
  } catch (cause) {
    throw new LlmError(
      "Gemini'ye bağlanılamadı veya istek reddedildi. API anahtarını ve kotanı kontrol et.",
      { cause },
    );
  }

  if (!rawText?.trim()) {
    throw new LlmError("Model boş yanıt döndürdü. Lütfen tekrar dene.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (cause) {
    throw new LlmError("Model geçerli JSON üretmedi.", {
      cause,
      details: rawText.slice(0, 500),
    });
  }

  // Son ve en önemli adım: modelin çıktısına GÜVENMİYORUZ.
  // Şemaya uymayan her şey burada durur; `.default([])` sayesinde eksik
  // diziler boş dizi olarak normalize edilir ve render katmanı `undefined` görmez.
  const result = CVDataSchema.safeParse(parsed);
  if (!result.success) {
    throw new LlmError("Model çıktısı beklenen CV şemasına uymuyor.", {
      details: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  return result.data;
}

/* ═══════════════════════════════════════════════════════════
   ORTAK ÇAĞRI YARDIMCISI

   Üç özellik de (CV, analiz, ön yazı) aynı beş adımı yapıyor:
   çağır → metni al → boş mu bak → JSON.parse → Zod ile doğrula.
   Bu adımları üç kez kopyalamak yerine tek yerde topluyoruz; böylece
   hata mesajları da her üçünde tutarlı oluyor.
   ═══════════════════════════════════════════════════════════ */

/** Tekrar denemenin anlamlı olduğu HTTP durumları. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/** SDK hatasından HTTP durum kodunu güvenle çıkarır. */
function statusOf(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status) || 0
    : 0;
}

/**
 * Durum koduna göre KULLANICIYA NE SÖYLENECEĞİNİ belirler.
 *
 * Neden tek bir genel mesaj yetmiyor? Çünkü kullanıcının atacağı adım
 * her durumda farklı: 401'de anahtarı kontrol etmeli, 404'te model adını,
 * 503'te ise hiçbir şey yapmayıp tekrar denemeli. Hepsine "API anahtarını
 * kontrol et" demek, sorunu olmayan yere bakmasına yol açıyor.
 */
export function llmErrorFor(status: number, cause?: unknown): LlmError {
  switch (status) {
    case 400:
      return new LlmError("Gemini isteği geçersiz buldu. Girdi çok uzun olabilir.", { cause });
    case 401:
    case 403:
      return new LlmError(
        ".env içindeki GOOGLE_API_KEY geçersiz ya da bu API'ye yetkisi yok.",
        { cause },
      );
    case 404:
      return new LlmError(
        `Model bulunamadı: "${GEMINI_MODEL}". .env içindeki GEMINI_MODEL değerini kontrol et.`,
        { cause },
      );
    case 429:
      return new LlmError("Kota doldu ya da çok hızlı istek attın. Biraz bekleyip tekrar dene.", {
        cause,
      });
    case 500:
    case 502:
    case 503:
    case 504:
      return new LlmError(
        `Gemini şu an yoğun. ${MAX_ATTEMPTS} deneme de başarısız oldu; birkaç saniye sonra tekrar dene. (Anahtarında bir sorun yok.)`,
        { cause },
      );
    default:
      return new LlmError("Gemini'ye ulaşılamadı. İnternet bağlantını kontrol et.", { cause });
  }
}

async function callGemini<T>(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: Schema,
  validator: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: z.ZodError } },
  label: string,
): Promise<T> {
  let rawText: string | undefined;
  let lastError: unknown;

  // Geçici hatalarda tekrar dene. İlk deneme başarısız olsa bile
  // ikincisi genellikle tutuyor — kullanıcı hatayı hiç görmez.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await getClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.4,
        },
      });
      rawText = response.text;
      lastError = undefined;
      break;
    } catch (cause) {
      lastError = cause;
      const status = statusOf(cause);

      // Kalıcı hatalar (geçersiz anahtar, yanlış model adı) tekrarla
      // düzelmez — beklemek sadece kullanıcıyı oyalar.
      if (!RETRYABLE_STATUSES.has(status) || attempt === MAX_ATTEMPTS) break;

      // Üstel bekleme: 1sn → 2sn → 4sn. Rastgele bir pay ekliyoruz ki
      // aynı anda başarısız olan istekler tekrar aynı anda vurmasın.
      const wait = 2 ** (attempt - 1) * 1000 + Math.random() * 300;
      console.warn(`[llm] ${label}: ${status} alındı, ${Math.round(wait)}ms sonra tekrar (${attempt}/${MAX_ATTEMPTS})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  if (lastError) throw llmErrorFor(statusOf(lastError), lastError);

  if (!rawText?.trim()) throw new LlmError(`Model ${label} için boş yanıt döndürdü.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (cause) {
    throw new LlmError(`Model ${label} için geçerli JSON üretmedi.`, {
      cause,
      details: rawText.slice(0, 500),
    });
  }

  const result = validator.safeParse(parsed);
  if (!result.success || !result.data) {
    throw new LlmError(`Model çıktısı beklenen ${label} şemasına uymuyor.`, {
      details: result.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  return result.data;
}

/* ═══════════════════════════════════════════════════════════
   İLAN UYUM ANALİZİ
   ═══════════════════════════════════════════════════════════ */

const GEMINI_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0-100 arası uyum puanı" },
    verdict: { type: Type.STRING, description: "1-2 cümlelik dürüst değerlendirme" },
    requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirement: { type: Type.STRING, description: "İlandan çıkarılan tek bir gereksinim" },
          status: {
            type: Type.STRING,
            format: "enum",
            enum: ["covered", "partial", "missing"],
          },
          evidence: {
            type: Type.STRING,
            description: "Adayın kendi ifadesinden kısa alıntı; missing ise boş string",
          },
          question: {
            type: Type.STRING,
            description: "Adaya sorulacak somut soru; covered ise boş string",
          },
        },
        required: ["requirement", "status", "evidence", "question"],
      },
    },
  },
  required: ["score", "verdict", "requirements"],
};

export async function analyzeJobMatch(profile: Profile, jobPosting: string): Promise<Analysis> {
  if (MOCK_LLM) return buildMockAnalysis(profile);
  return callGemini(
    ANALYSIS_SYSTEM_PROMPT,
    buildAnalysisPrompt(profile, jobPosting),
    GEMINI_ANALYSIS_SCHEMA,
    AnalysisSchema,
    "ilan analizi",
  );
}

/* ═══════════════════════════════════════════════════════════
   ÖN YAZI
   ═══════════════════════════════════════════════════════════ */

const GEMINI_LETTER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Adayın tam adı" },
    contactLines: { ...stringArray, description: "E-posta, telefon, şehir" },
    greeting: { type: Type.STRING, description: "örn. 'Sayın İnsan Kaynakları Yetkilisi,'" },
    subject: { type: Type.STRING, description: "Konu satırı; gerekmiyorsa boş string" },
    paragraphs: {
      ...stringArray,
      description: "3-4 gövde paragrafı, toplam 150-250 kelime",
    },
    closing: { type: Type.STRING, description: "örn. 'Saygılarımla,'" },
  },
  required: ["name", "contactLines", "greeting", "subject", "paragraphs", "closing"],
};

export async function generateLetter(profile: Profile, jobPosting: string): Promise<LetterData> {
  if (MOCK_LLM) return buildMockLetter(profile);
  return callGemini(
    LETTER_SYSTEM_PROMPT,
    buildLetterPrompt(profile, jobPosting),
    GEMINI_LETTER_SCHEMA,
    LetterDataSchema,
    "ön yazı",
  );
}

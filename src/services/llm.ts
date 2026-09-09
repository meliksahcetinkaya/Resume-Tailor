import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { GEMINI_MODEL, GOOGLE_API_KEY, MOCK_LLM } from "../config.ts";
import { LlmError } from "../errors.ts";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompts/cvPrompts.ts";
import { CVDataSchema, type CVData } from "../schemas/cvSchema.ts";
import type { Profile } from "../schemas/requestSchema.ts";
import { buildMockCv } from "./mockCv.ts";

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

import { z } from "zod";

/**
 * İLAN UYUM ANALİZİ
 *
 * Bu şema, "bu ilan neyi istiyor ve adayda var mı?" sorusunun cevabını taşır.
 * CV üretiminden AYRI bir LLM çağrısıyla doldurulur çünkü iki iş farklıdır:
 * CV üretimi metin YAZAR, analiz ise KARŞILAŞTIRIR. Tek çağrıda birleştirmek
 * modelin dikkatini böler ve iki çıktının kalitesini de düşürür.
 *
 * Amacı, uydurmadan zenginleştirmek: model eksik gördüğü yeri kendi
 * doldurmak yerine KULLANICIYA SORAR.
 */

/**
 * Durum değerleri neden İngilizce?
 * Gemini'nin enum desteğine Türkçe karakter göndermemek için. Arayüzde
 * Türkçesine çevriliyor; veri katmanında sade ASCII kalıyor.
 */
export const RequirementStatus = z.enum(["covered", "partial", "missing"]);

export const RequirementSchema = z.object({
  /** İlandan çıkarılan tek bir gereksinim, örn. "PostgreSQL sorgu optimizasyonu". */
  requirement: z.string().min(1),
  status: RequirementStatus,
  /**
   * covered/partial ise: profilde bunu destekleyen ifade.
   * Kullanıcı "model bunu nereden çıkardı?" diye sorabilmeli — bu alan
   * analizi denetlenebilir kılar.
   */
  evidence: z.string().default(""),
  /**
   * partial/missing ise: kullanıcıya sorulacak SOMUT soru.
   * "Docker biliyor musun?" değil; "Docker'ı hangi projede, ne için
   * kullandın?" gibi cevabı doğrudan CV'ye girebilecek bir soru.
   */
  question: z.string().default(""),
});

export const AnalysisSchema = z.object({
  /** 0-100. Karşılanan gereksinimlerin ağırlıklı oranı. */
  score: z.number().int().min(0).max(100),
  /** 1-2 cümlelik genel değerlendirme. */
  verdict: z.string().min(1),
  requirements: z.array(RequirementSchema).min(1),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;

import { z } from "zod";

/**
 * ÖN YAZI (cover letter)
 *
 * CV'den ayrı bir belge, ayrı bir şema. Neden CVData'ya alan eklemedik?
 * Çünkü ikisinin ömrü ve amacı farklı: CV bir envanterdir (bölümler,
 * listeler), ön yazı bir mektuptur (hitap, paragraflar, kapanış).
 * Tek şemada birleştirmek her iki render katmanını da "bu alan bu belgede
 * var mı?" kontrolleriyle doldururdu.
 */
export const LetterDataSchema = z.object({
  /** Mektup başlığında görünen ad — CV ile aynı kişi. */
  name: z.string().min(1),
  /** E-posta, telefon, şehir — CV'dekiyle aynı biçim. */
  contactLines: z.array(z.string()).default([]),
  /** "Sayın İnsan Kaynakları Yetkilisi," — ilanda isim geçiyorsa o kullanılır. */
  greeting: z.string().min(1),
  /** Konu satırı: "Backend Developer pozisyonu başvurusu hakkında". */
  subject: z.string().default(""),
  /**
   * Gövde paragrafları. 3-4 paragraf hedeflenir:
   * neden bu pozisyon → en alakalı kanıt → neden bu şirket/kapanış.
   * Dizi olarak tutulur çünkü render katmanı her paragrafı ayrı basar.
   */
  paragraphs: z.array(z.string().min(1)).min(1),
  /** "Saygılarımla," */
  closing: z.string().min(1),
});

export type LetterData = z.infer<typeof LetterDataSchema>;

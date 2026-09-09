import { z } from "zod";
import { CVDataSchema } from "./cvSchema.ts";
import { LetterDataSchema } from "./letterSchema.ts";

/**
 * İSTEK gövdelerinin şemaları.
 *
 * LLM çıktısına güvenmediğimiz gibi, tarayıcıdan gelen gövdeye de güvenmiyoruz.
 * Aynı doğrulama hikâyesini (Zod) her iki sınırda da kullanıyoruz.
 */

/** Aşırı büyük gövdelerin hem LLM maliyetini hem belleği şişirmesini engeller. */
const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(5_000);

/**
 * Kullanıcının formda girdiği HAM bilgi.
 * Dikkat: burası CVData DEĞİL. Bu, kullanıcının dağınık girdisi;
 * CVData ise LLM'in ilana göre uyarlanmış çıktısı.
 */
export const ProfileSchema = z.object({
  fullName: shortText.min(1, "Ad soyad gerekli"),
  /** Serbest metin: e-posta, telefon, LinkedIn, şehir — satır satır. */
  contact: longText.default(""),
  education: z
    .array(
      z.object({
        degree: shortText.default(""),
        institution: shortText.default(""),
        dates: shortText.default(""),
      }),
    )
    .max(20)
    .default([]),
  experience: z
    .array(
      z.object({
        title: shortText.default(""),
        company: shortText.default(""),
        dates: shortText.default(""),
        /** Kullanıcı ne yaptığını serbestçe yazar; maddeleri LLM üretir. */
        description: longText.default(""),
      }),
    )
    .max(20)
    .default([]),
  projects: z
    .array(
      z.object({
        title: shortText.default(""),
        description: longText.default(""),
      }),
    )
    .max(20)
    .default([]),
  /** Virgülle ayrılmış serbest metin; kategorilere LLM ayırır. */
  skills: longText.default(""),
  languages: longText.default(""),
  /** Şemaya oturmayan her şey: sertifika, ödül, gönüllülük... */
  extra: longText.default(""),
  /**
   * İlan analizinde sorulan sorulara verilen cevaplar.
   *
   * Neden profilin parçası? Çünkü cevap ("Docker'ı 2 yıldır CI/CD'de
   * kullanıyorum") kullanıcının unuttuğu KALICI bir bilgidir, o ilana
   * özel geçici bir not değil. Profile yazılınca localStorage'a da
   * kaydedilir ve sonraki başvurularda kullanılır — profil kullandıkça
   * kendiliğinden zenginleşir.
   */
  answers: z
    .array(
      z.object({
        question: shortText.min(1),
        answer: longText.min(1),
      }),
    )
    .max(30)
    .default([]),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const GenerateCvRequestSchema = z.object({
  profile: ProfileSchema,
  jobPosting: z.string().trim().min(20, "İş ilanı çok kısa").max(20_000),
});

export type GenerateCvRequest = z.infer<typeof GenerateCvRequestSchema>;

/**
 * Render uç noktaları, kullanıcının önizlemede DÜZENLEMİŞ olabileceği
 * cvData'yı alır — bu yüzden tekrar doğrulanır.
 */
export const RenderRequestSchema = z.object({
  cvData: CVDataSchema,
});

/** İlan analizi ve ön yazı, CV üretimiyle aynı girdiyi alır. */
export const AnalyzeRequestSchema = GenerateCvRequestSchema;
export const GenerateLetterRequestSchema = GenerateCvRequestSchema;

/** Ön yazı render uç noktaları, düzenlenmiş olabilecek mektubu alır. */
export const RenderLetterRequestSchema = z.object({
  letterData: LetterDataSchema,
});

import { z } from "zod";

/**
 * CV'nin veri modeli.
 *
 * Bu şema iki iş birden yapar:
 *  1. ÇALIŞMA ANINDA doğrulama — LLM'den gelen JSON'a güvenmiyoruz.
 *  2. DERLEME ANINDA tip — `z.infer` ile TS tipini şemadan türetiyoruz,
 *     böylece şema ile tip asla birbirinden ayrı düşmüyor.
 *
 * `.default([])` kullanımı bilinçli: `.optional()` olsaydı tip `T[] | undefined`
 * olur ve render katmanının her yerde `?.` yazması gerekirdi. `.default([])`
 * sayesinde parse'tan SONRA alan her zaman dizidir. Doğrulama sınırı aynı
 * zamanda normalizasyon sınırıdır.
 */

export const ExperienceItemSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().default(""),
  /** Serbest metin: "2022 – Halen", "Eylül 2021 – Mart 2023". Date'e çevirmiyoruz. */
  dates: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
});

export const EducationItemSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  location: z.string().default(""),
  dates: z.string().min(1),
});

export const ProjectItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tech: z.array(z.string()).default([]),
});

export const SkillCategorySchema = z.object({
  /** "Diller", "Frameworkler", "Araçlar" gibi. */
  category: z.string().min(1),
  items: z.array(z.string()).min(1),
});

/**
 * Şemadaki kalıplara oturmayan bilgiler için güvenlik valfi:
 * sertifikalar, ödüller, gönüllü çalışmalar, yayınlar...
 * Bu alan olmasaydı LLM bu bilgileri ya uydurma bir "deneyim"e sokardı
 * ya da sessizce atardı.
 */
export const AdditionalSectionSchema = z.object({
  heading: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
});

export const CVDataSchema = z.object({
  name: z.string().min(1),
  /** Ad altındaki unvan satır(lar)ı: "Backend Developer". */
  headerLines: z.array(z.string()).default([]),
  /** E-posta, telefon, LinkedIn, şehir... */
  contactLines: z.array(z.string()).default([]),
  summary: z.string().min(1),
  education: z.array(EducationItemSchema).default([]),
  experience: z.array(ExperienceItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  skillCategories: z.array(SkillCategorySchema).default([]),
  languages: z.array(z.string()).default([]),
  additionalSections: z.array(AdditionalSectionSchema).default([]),
});

export type CVData = z.infer<typeof CVDataSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type SkillCategory = z.infer<typeof SkillCategorySchema>;
export type AdditionalSection = z.infer<typeof AdditionalSectionSchema>;

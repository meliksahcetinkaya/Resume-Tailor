import type { CVData } from "../schemas/cvSchema.ts";
import type { Profile } from "../schemas/requestSchema.ts";

/**
 * MOCK_LLM=true iken kullanılan sahte üretici.
 *
 * Amacı: Gemini'ye tek istek atmadan tüm akışı (route → önizleme → docx → pdf)
 * çalıştırabilmek. Arayüzü, şablonu ve dosya üretimini geliştirirken ücretsiz
 * kotayı yakmazsın ve internet olmadan çalışabilirsin.
 *
 * Kullanıcının gerçekten girdiği ad/iletişim bilgisini kullanır ki önizlemede
 * "veri doğru yere akıyor mu?" sorusunu da test edebilesin.
 */
export function buildMockCv(profile: Profile): CVData {
  const contactLines = profile.contact
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: profile.fullName,
    headerLines: ["Backend Developer"],
    contactLines: contactLines.length
      ? contactLines
      : ["ornek@eposta.com", "+90 555 000 00 00", "İstanbul"],
    summary:
      "[MOCK] Node.js ve TypeScript ile ölçeklenebilir servisler geliştiren, " +
      "REST API tasarımı ve ilişkisel veritabanı optimizasyonu konusunda deneyimli geliştirici. " +
      "Bu metin sahte veridir; gerçek üretim için MOCK_LLM=false yapın.",
    education: [
      {
        degree: "Bilgisayar Mühendisliği, Lisans",
        institution: "Örnek Üniversitesi",
        location: "İstanbul",
        dates: "2018 – 2022",
      },
    ],
    experience: [
      {
        title: "Backend Developer",
        company: "Örnek Teknoloji A.Ş.",
        location: "İstanbul",
        dates: "2022 – Halen",
        bullets: [
          "Sipariş yönetimi servisini Node.js ve PostgreSQL ile tasarladı ve hayata geçirdi.",
          "Yavaş çalışan raporlama sorgularını indeksleyerek yanıt süresini belirgin şekilde düşürdü.",
          "Servisler arası iletişimi kuyruk tabanlı bir yapıya taşıyarak hata toleransını artırdı.",
        ],
      },
    ],
    projects: [
      {
        title: "Stok Takip Paneli",
        description:
          "Depo stoklarını gerçek zamanlı izleyen web uygulaması; kritik seviye altına düşen ürünler için uyarı üretir.",
        tech: ["Node.js", "TypeScript", "React", "PostgreSQL"],
      },
    ],
    skillCategories: [
      { category: "Diller", items: ["TypeScript", "JavaScript", "SQL"] },
      { category: "Frameworkler", items: ["Express", "Node.js"] },
      { category: "Veritabanları", items: ["PostgreSQL", "Redis"] },
    ],
    languages: ["Türkçe (Ana dil)", "İngilizce (B2)"],
    additionalSections: [
      { heading: "Sertifikalar", items: ["[MOCK] Örnek Sertifika – 2024"] },
    ],
  };
}

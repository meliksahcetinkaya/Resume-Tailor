import type { CVData } from "../schemas/cvSchema.ts";
import type { Profile } from "../schemas/requestSchema.ts";
import type { Analysis } from "../schemas/analysisSchema.ts";
import type { LetterData } from "../schemas/letterSchema.ts";

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

/** MOCK_LLM=true iken ilan analizi yerine dönen sabit sonuç. */
export function buildMockAnalysis(_profile: Profile): Analysis {
  return {
    score: 68,
    verdict:
      "[MOCK] Teknik gereksinimlerin çoğu karşılanıyor ancak test ve mimari " +
      "tarafında profilde açık bir dayanak yok. Bu metin sahtedir.",
    requirements: [
      {
        requirement: "Node.js ile REST API geliştirme",
        status: "covered",
        evidence: "Sipariş servisini Node.js ile yazdım",
        question: "",
      },
      {
        requirement: "PostgreSQL sorgu optimizasyonu",
        status: "partial",
        evidence: "raporlama sorguları çok yavaştı, indeksleyip hızlandırdım",
        question:
          "Optimizasyonu nasıl yaptın? EXPLAIN ile analiz ettin mi, hangi indeks türünü seçtin?",
      },
      {
        requirement: "Test yazma alışkanlığı",
        status: "missing",
        evidence: "",
        question: "Hiç birim veya entegrasyon testi yazdın mı? Hangi araçla, ne kadar kapsamda?",
      },
    ],
  };
}

/** MOCK_LLM=true iken ön yazı yerine dönen sabit metin. */
export function buildMockLetter(profile: Profile): LetterData {
  const contactLines = profile.contact
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: profile.fullName,
    contactLines: contactLines.length ? contactLines : ["ornek@eposta.com", "İstanbul"],
    greeting: "Sayın İnsan Kaynakları Yetkilisi,",
    subject: "[MOCK] Backend Developer pozisyonu başvurusu",
    paragraphs: [
      "[MOCK] Bu bir örnek ön yazıdır; gerçek üretim için MOCK_LLM=false yapın. " +
        "İlanınızda belirtilen Backend Developer pozisyonuna başvurmak istiyorum.",
      "Son iki yıldır Node.js ve PostgreSQL ile sipariş yönetimi servisleri geliştiriyorum. " +
        "Yavaş çalışan raporlama sorgularını indeksleyerek yanıt süresini belirgin şekilde düşürdüm.",
      "Görüşme fırsatı bulabilirsek deneyimimi ayrıntılı olarak paylaşmaktan memnuniyet duyarım.",
    ],
    closing: "Saygılarımla,",
  };
}

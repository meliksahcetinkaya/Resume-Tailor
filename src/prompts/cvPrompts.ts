import type { Profile } from "../schemas/requestSchema.ts";

/**
 * Prompt'lar koda gömülmez, buraya toplanır.
 *
 * Neden? Prompt bu uygulamanın en sık değişecek parçası — çıktı kalitesini
 * ayarlamak için defalarca dokunacaksın. Servis mantığıyla iç içe olursa
 * her denemede iş mantığını riske atarsın. Ayrıca saf string üreten
 * fonksiyonlar olduğu için test edilmeleri bedava.
 */

export const SYSTEM_PROMPT = `Sen deneyimli bir profesyonel CV yazarısın.

Sana bir adayın kendisi hakkında verdiği HAM bilgiler ve hedeflediği İŞ İLANI verilecek.
Bu bilgilerden, o pozisyona en uygun ve en etkileyici CV'yi SIFIRDAN kur.

KURALLAR:
1. UYDURMA. Adayın vermediği hiçbir şirket, tarih, unvan, teknoloji veya başarı ekleme.
   Aday somut bir sayı/yüzde vermediyse sayı uydurma; bunun yerine güçlü bir eylem
   fiiliyle etkiyi anlat.
2. UYARLA. İlanla en alakalı deneyim, proje ve becerileri öne çıkar; alakasız olanları
   kısalt veya en sona al. Sıralama senin kararın.
3. ÖZET, doğrudan bu role hitap etsin. Genel geçer klişe yazma ("takım oyuncusu",
   "detay odaklı" gibi içi boş ifadelerden kaçın).
4. MADDELER eylem fiiliyle başlasın, tek cümle olsun, ne yapıldığını ve etkisini söylesin.
   Her deneyim için 2-5 madde üret.
5. BECERİLERİ anlamlı kategorilere ayır (örn. "Diller", "Frameworkler", "Veritabanları",
   "Araçlar"). Adayın yazdığı becerileri kullan, ilanda geçip adayda olmayanı EKLEME.
6. DİL: CV'yi iş ilanının yazıldığı dilde yaz. İlan Türkçeyse Türkçe, İngilizceyse İngilizce.
7. Adayın "ek bilgi" olarak yazdığı ve eğitim/deneyim/proje/beceri kalıplarına oturmayan
   şeyleri (sertifika, ödül, gönüllülük, yayın) additionalSections içinde uygun bir
   başlık altında topla.
8. Bilgi yoksa ilgili diziyi boş bırak. Doldurmak için içerik icat etme.`;

/** Boş/whitespace alanları ayıklayıp "Etiket: değer" satırı üretir. */
function line(label: string, value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

/**
 * Profile nesnesini LLM'in rahat okuyacağı düz metne çevirir.
 *
 * Neden JSON'u doğrudan prompt'a gömmüyoruz? Gömebilirdik ve çalışırdı da.
 * Ama düz metin hem token açısından daha ucuz hem de modelin dikkatini
 * alan adlarına değil İÇERİĞE yöneltiyor. Ayrıca boş alanları burada
 * eleyerek modele "bu alan boş" gürültüsü göndermemiş oluyoruz.
 */
export function formatProfile(profile: Profile): string {
  const parts: string[] = [`AD SOYAD: ${profile.fullName}`];

  if (profile.contact.trim()) {
    parts.push(`\nİLETİŞİM:\n${profile.contact.trim()}`);
  }

  const education = profile.education
    .map((e) => [line("Derece", e.degree), line("Kurum", e.institution), line("Tarih", e.dates)]
      .filter(Boolean)
      .join(" | "))
    .filter((s) => s.length > 0);
  if (education.length) {
    parts.push(`\nEĞİTİM:\n${education.map((s) => `- ${s}`).join("\n")}`);
  }

  const experience = profile.experience
    .map((e) => {
      const header = [line("Pozisyon", e.title), line("Şirket", e.company), line("Tarih", e.dates)]
        .filter(Boolean)
        .join(" | ");
      const body = e.description.trim();
      if (!header && !body) return "";
      return body ? `- ${header}\n  Aday şunları anlatıyor: ${body}` : `- ${header}`;
    })
    .filter((s) => s.length > 0);
  if (experience.length) {
    parts.push(`\nDENEYİM:\n${experience.join("\n")}`);
  }

  const projects = profile.projects
    .map((p) => {
      const title = p.title.trim();
      const desc = p.description.trim();
      if (!title && !desc) return "";
      return title && desc ? `- ${title}: ${desc}` : `- ${title || desc}`;
    })
    .filter((s) => s.length > 0);
  if (projects.length) {
    parts.push(`\nPROJELER:\n${projects.join("\n")}`);
  }

  if (profile.skills.trim()) parts.push(`\nBECERİLER:\n${profile.skills.trim()}`);
  if (profile.languages.trim()) parts.push(`\nYABANCI DİLLER:\n${profile.languages.trim()}`);
  if (profile.extra.trim()) parts.push(`\nEK BİLGİLER:\n${profile.extra.trim()}`);

  // İlan analizinde sorulan sorulara verilen cevaplar. Ayrı bir başlık
  // altında veriliyor ki model bunların adayın DOĞRUDAN beyanı olduğunu
  // bilsin — bu bilgiler diğer alanlardan daha taze ve daha spesifiktir.
  const answered = profile.answers.filter((a) => a.answer.trim());
  if (answered.length) {
    parts.push(
      "\nADAYA SORULAN SORULAR VE CEVAPLARI:\n" +
        answered.map((a) => `- S: ${a.question}\n  C: ${a.answer.trim()}`).join("\n"),
    );
  }

  return parts.join("\n");
}

/** Modele gönderilecek nihai kullanıcı mesajı. */
export function buildUserPrompt(profile: Profile, jobPosting: string): string {
  return [
    "=== ADAY BİLGİLERİ ===",
    formatProfile(profile),
    "",
    "=== İŞ İLANI ===",
    jobPosting.trim(),
    "",
    "Yukarıdaki adayın bilgilerinden, bu ilana özel CV'yi üret.",
  ].join("\n");
}

/* ═══════════════ İLAN UYUM ANALİZİ ═══════════════ */

export const ANALYSIS_SYSTEM_PROMPT = `Sen teknik bir işe alım uzmanısın.

Sana bir iş ilanı ve bir adayın bilgileri verilecek. Görevin CV YAZMAK DEĞİL,
ilanın istediklerini adayın verdikleriyle KARŞILAŞTIRMAK.

ADIMLAR:
1. İlandan somut gereksinimleri çıkar (5-10 tane). Her biri TEK bir şey olsun:
   "Node.js ve PostgreSQL" değil, ayrı ayrı. "İyi iletişim" gibi ölçülemeyen
   klişeleri alma; teknoloji, yöntem, deneyim türü gibi doğrulanabilir olanları al.
2. Her gereksinimi adayın bilgileriyle karşılaştır ve durumunu belirle:
   - "covered"  : Adayın metninde açık bir dayanak var.
   - "partial"  : İlgili bir şey var ama yeterince açık değil (örn. aday
                  "veritabanı kullandım" demiş, ilan "sorgu optimizasyonu" istiyor).
   - "missing"  : Adayın metninde hiçbir iz yok.
3. covered/partial için evidence alanına adayın KENDİ İFADESİNDEN kısa bir alıntı yaz.
   Uydurma; gerçekten yazdığı bir şey olmalı. missing ise evidence boş kalsın.
4. partial/missing için question alanına adaya sorulacak SOMUT bir soru yaz.
   Kötü soru: "Docker biliyor musun?"
   İyi soru:  "Docker'ı hangi projede, hangi amaçla kullandın? Kaç servis vardı?"
   Soru öyle olsun ki cevabı doğrudan bir CV maddesine dönüşebilsin.
   covered ise question boş kalsın.
5. score: karşılananların oranından 0-100 arası bir puan üret.
   covered = tam puan, partial = yarım puan, missing = sıfır.
6. verdict: 1-2 cümlelik dürüst değerlendirme. Abartma, moral vermeye çalışma.
   Eksikler ciddiyse söyle.

DİL: İlan hangi dildeyse o dilde yaz.
ASLA adayda olmayan bir şeyi "var" gösterme. Bu analizin tek değeri dürüstlüğü.`;

export function buildAnalysisPrompt(profile: Profile, jobPosting: string): string {
  return [
    "=== ADAY BİLGİLERİ ===",
    formatProfile(profile),
    "",
    "=== İŞ İLANI ===",
    jobPosting.trim(),
    "",
    "Bu ilanın gereksinimlerini çıkar ve adayın durumuyla karşılaştır.",
  ].join("\n");
}

/* ═══════════════ ÖN YAZI ═══════════════ */

export const LETTER_SYSTEM_PROMPT = `Sen profesyonel bir ön yazı (cover letter) yazarısın.

Sana bir adayın bilgileri ve hedeflediği iş ilanı verilecek. Bu pozisyona
başvuru için kısa, samimi ama profesyonel bir ön yazı yaz.

KURALLAR:
1. UYDURMA. Adayın vermediği deneyim, şirket, başarı veya beceriyi yazma.
   Sayı verilmemişse sayı uydurma.
2. YAPISI 3-4 paragraf olsun:
   - 1. paragraf: Hangi pozisyona, neden başvurduğu. Doğrudan konuya gir.
   - 2. paragraf: İlanın en kritik isteğine karşılık gelen EN GÜÇLÜ kanıtı anlat.
     Genel geçer değil, somut bir iş/proje üzerinden.
   - 3. paragraf: İkinci güçlü kanıt ya da adayın bu role neden uygun olduğu.
   - Son paragraf: Kısa kapanış, görüşme talebi.
3. CV'Yİ TEKRARLAMA. Ön yazı, CV'deki maddelerin listesi değildir; bir veya iki
   şeyi seçip anlatır. Okuyan kişi CV'yi zaten görecek.
4. KLİŞE YASAK: "takım oyuncusu", "kendimi geliştirmeye açık", "dinamik bir
   ekipte çalışmak istiyorum" gibi içi boş ifadeler kullanma.
5. UZUNLUK: Toplam 150-250 kelime. Tek sayfayı geçmesin. Kısa olan okunur.
6. HİTAP: İlanda bir isim/şirket geçiyorsa kullan. Yoksa "Sayın İnsan Kaynakları
   Yetkilisi," gibi nötr bir hitap yaz.
7. DİL: İlan hangi dildeyse o dilde yaz.`;

export function buildLetterPrompt(profile: Profile, jobPosting: string): string {
  return [
    "=== ADAY BİLGİLERİ ===",
    formatProfile(profile),
    "",
    "=== İŞ İLANI ===",
    jobPosting.trim(),
    "",
    "Bu adayın bu ilana başvurusu için ön yazıyı yaz.",
  ].join("\n");
}

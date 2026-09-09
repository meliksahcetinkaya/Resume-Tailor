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

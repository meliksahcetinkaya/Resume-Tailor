import type { CVData } from "../schemas/cvSchema.ts";

/**
 * CVData -> tam bir HTML dokümanı (saf fonksiyon).
 *
 * Bu dosya İKİ yerde kullanılır:
 *   1. pdfBuilder.ts → Puppeteer bu HTML'i açıp PDF'e basar,
 *   2. POST /api/preview → tarayıcıdaki önizleme iframe'i.
 *
 * Aynı fonksiyonu kullanmalarının değeri şu: önizlemede gördüğün şey,
 * indirdiğin PDF'in birebir aynısıdır. İki ayrı şablon olsaydı
 * kaçınılmaz olarak birbirlerinden ayrı düşerlerdi.
 *
 * Saf fonksiyon olması (girdi -> çıktı, yan etki yok) test edilmesini
 * de ücretsiz kılıyor: tarayıcı da sunucu da gerekmiyor.
 */

/**
 * HTML özel karakterlerini kaçırır.
 *
 * NEDEN ZORUNLU: Buraya giren metnin bir kısmı kullanıcının kendi yazdığı,
 * bir kısmı LLM'in ürettiği veridir. Kaçırmadan HTML'e gömersek, içindeki
 * `<script>` benzeri bir dizge önizleme iframe'inde ÇALIŞIR (XSS).
 * Kaçırma işini şablonun tek bir noktasında yapmak, "bir yerde unutma"
 * riskini ortadan kaldırır.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Boş bölümler hiç basılmasın diye küçük yardımcı. */
function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section class="sec">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>`;
}

function bulletList(items: readonly string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
}

/** "Sol başlık ......... sağ tarih" satırı. */
function entryHead(left: string, right: string): string {
  return `<div class="entry-head">
      <span class="entry-left">${left}</span>
      <span class="entry-right">${escapeHtml(right)}</span>
    </div>`;
}

const STYLES = `
  @page { size: A4; margin: 16mm 15mm; }

  * { box-sizing: border-box; }

  html, body { margin: 0; padding: 0; }

  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { max-width: 210mm; margin: 0 auto; }

  /* Kenar boşlukları iki ortamda FARKLI kaynaktan gelir:
     - PDF'te @page kuralı hallediyor (yukarıda),
     - ekranda (önizleme iframe'i) @page geçerli olmadığı için metin
       kenara yapışırdı; bu yüzden ekrana özel padding veriyoruz.
     Amaç: önizlemenin PDF ile aynı görünmesi. */
  @media screen { .page { padding: 16mm 15mm; } }
  @media print  { .page { padding: 0; max-width: none; } }

  header { text-align: center; margin-bottom: 14px; }

  h1 {
    margin: 0 0 4px;
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .header-lines { font-size: 11pt; color: #444; margin-bottom: 5px; }

  .contact { font-size: 9.5pt; color: #555; }
  .contact span:not(:last-child)::after { content: " · "; color: #aaa; }

  .sec { margin-top: 15px; }

  h2 {
    margin: 0 0 7px;
    font-size: 10.5pt;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: #000;
    border-bottom: 1.2px solid #333;
    padding-bottom: 3px;
  }

  p { margin: 0 0 6px; text-align: justify; }

  .entry { margin-bottom: 10px; }
  /* Bir deneyim bloğu sayfa sonunda ikiye bölünmesin. */
  .entry { break-inside: avoid; page-break-inside: avoid; }

  .entry-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .entry-left { font-size: 10.5pt; }
  .entry-left .role { font-weight: 700; }
  .entry-left .org { font-weight: 400; }
  .entry-left .loc { color: #666; font-style: italic; }

  .entry-right { font-size: 9.5pt; color: #555; white-space: nowrap; }

  ul { margin: 4px 0 0; padding-left: 17px; }
  li { margin-bottom: 2.5px; }

  .kv { margin-bottom: 4px; }
  .kv .k { font-weight: 700; }

  .tech { font-size: 9.5pt; color: #555; margin-top: 2px; }
  .tech .k { font-weight: 700; color: #333; }
`;

export function renderCvHtml(cv: CVData): string {
  const header = `<header>
      <h1>${escapeHtml(cv.name)}</h1>
      ${
        cv.headerLines.length
          ? `<div class="header-lines">${cv.headerLines.map(escapeHtml).join(" · ")}</div>`
          : ""
      }
      ${
        cv.contactLines.length
          ? `<div class="contact">${cv.contactLines
              .map((c) => `<span>${escapeHtml(c)}</span>`)
              .join("")}</div>`
          : ""
      }
    </header>`;

  const summary = section("Profesyonel Özet", `<p>${escapeHtml(cv.summary)}</p>`);

  const experience = section(
    "Deneyim",
    cv.experience
      .map((e) => {
        const left =
          `<span class="role">${escapeHtml(e.title)}</span>` +
          `<span class="org"> — ${escapeHtml(e.company)}</span>` +
          (e.location ? `<span class="loc">, ${escapeHtml(e.location)}</span>` : "");
        return `<div class="entry">${entryHead(left, e.dates)}${bulletList(e.bullets)}</div>`;
      })
      .join(""),
  );

  const projects = section(
    "Projeler",
    cv.projects
      .map((p) => {
        const tech = p.tech.length
          ? `<div class="tech"><span class="k">Teknolojiler:</span> ${escapeHtml(p.tech.join(", "))}</div>`
          : "";
        return `<div class="entry">
          <div class="entry-head"><span class="entry-left"><span class="role">${escapeHtml(p.title)}</span></span></div>
          <p>${escapeHtml(p.description)}</p>
          ${tech}
        </div>`;
      })
      .join(""),
  );

  const education = section(
    "Eğitim",
    cv.education
      .map((e) => {
        const left =
          `<span class="role">${escapeHtml(e.degree)}</span>` +
          `<span class="org"> — ${escapeHtml(e.institution)}</span>` +
          (e.location ? `<span class="loc">, ${escapeHtml(e.location)}</span>` : "");
        return `<div class="entry">${entryHead(left, e.dates)}</div>`;
      })
      .join(""),
  );

  const skills = section(
    "Beceriler",
    cv.skillCategories
      .map(
        (s) =>
          `<div class="kv"><span class="k">${escapeHtml(s.category)}:</span> ${escapeHtml(
            s.items.join(", "),
          )}</div>`,
      )
      .join(""),
  );

  const languages = section(
    "Diller",
    cv.languages.length ? `<p>${escapeHtml(cv.languages.join(" · "))}</p>` : "",
  );

  const extras = cv.additionalSections
    .map((s) => section(s.heading, bulletList(s.items)))
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(cv.name)} — CV</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
${header}
${summary}
${experience}
${projects}
${education}
${skills}
${languages}
${extras}
</div>
</body>
</html>`;
}

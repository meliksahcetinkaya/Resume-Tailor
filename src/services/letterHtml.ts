import type { LetterData } from "../schemas/letterSchema.ts";
import { escapeHtml } from "./cvHtml.ts";

/**
 * LetterData -> tam bir HTML dokümanı (saf fonksiyon).
 *
 * cvHtml.ts ile aynı kalıp: önizleme ve PDF aynı fonksiyondan beslenir,
 * böylece ekranda gördüğün indirdiğinle birebir aynı olur.
 *
 * escapeHtml'i cvHtml.ts'ten alıyoruz — iki ayrı kopya tutup birinde
 * bir karakteri unutmak, sessiz bir XSS açığı demek olurdu.
 */

const STYLES = `
  @page { size: A4; margin: 25mm 22mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    background: #fff;
  }

  .page { max-width: 210mm; margin: 0 auto; }
  @media screen { .page { padding: 25mm 22mm; } }
  @media print  { .page { padding: 0; max-width: none; } }

  header { border-bottom: 1.2px solid #333; padding-bottom: 10px; margin-bottom: 26px; }

  h1 {
    margin: 0 0 5px;
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .contact { font-size: 9.5pt; color: #555; }
  .contact span:not(:last-child)::after { content: " · "; color: #aaa; }

  .subject { font-weight: 700; margin-bottom: 20px; }

  .greeting { margin-bottom: 16px; }

  /* Mektup paragrafları CV'den farklı: daha geniş satır aralığı,
     paragraf arası boşluk. Mektup okunmak için, taranmak için değil. */
  .body p { margin: 0 0 13px; text-align: justify; }

  .closing { margin-top: 24px; }
  .signature { margin-top: 26px; font-weight: 700; }
`;

export function renderLetterHtml(letter: LetterData): string {
  const contact = letter.contactLines.length
    ? `<div class="contact">${letter.contactLines
        .map((c) => `<span>${escapeHtml(c)}</span>`)
        .join("")}</div>`
    : "";

  const subject = letter.subject.trim()
    ? `<p class="subject">${escapeHtml(letter.subject)}</p>`
    : "";

  const paragraphs = letter.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(letter.name)} — Ön Yazı</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header>
    <h1>${escapeHtml(letter.name)}</h1>
    ${contact}
  </header>
  ${subject}
  <p class="greeting">${escapeHtml(letter.greeting)}</p>
  <div class="body">${paragraphs}</div>
  <p class="closing">${escapeHtml(letter.closing)}</p>
  <p class="signature">${escapeHtml(letter.name)}</p>
</div>
</body>
</html>`;
}

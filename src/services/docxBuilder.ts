import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
  type ISectionOptions,
} from "docx";
import { RenderError } from "../errors.ts";
import type { CVData } from "../schemas/cvSchema.ts";
import type { LetterData } from "../schemas/letterSchema.ts";

/**
 * CVData -> .docx
 *
 * NEDEN AYRI BİR ÜRETİCİ (PDF'i Word'e çevirmek yerine)?
 * PDF sabit bir düzendir; Word'e çevrilince metin kutularına dönüşür ve
 * DÜZENLENEMEZ hale gelir. Word çıktısının tek varlık sebebi kullanıcının
 * CV'yi kendi düzenleyebilmesi. Bu yüzden gerçek paragraflar, gerçek madde
 * listeleri üretiyoruz.
 *
 * ÖLÇÜ BİRİMLERİ (Word'ün tuhaflığı):
 *   - Uzunluklar "twip" cinsindendir: 1 twip = 1/20 punto = 1/1440 inç.
 *   - Font boyutu "yarım punto" cinsindendir: size: 21 => 10.5pt.
 * Bu yüzden aşağıda convertMillimetersToTwip gibi yardımcılar kullanıyoruz.
 */

const FONT = "Calibri";
const BODY_SIZE = 21; // 10.5pt (yarım punto)
const NAME_SIZE = 44; // 22pt

/**
 * Sağa yaslı tarih için TAB STOP tekniği.
 *
 * Word'de "solda başlık, sağda tarih" görünümünü elde etmenin iki yolu var:
 * kenarlıksız bir tablo, ya da satırın en sağına sabitlenmiş bir sekme durağı.
 * Sekme durağı daha hafif: tek paragraf, tablo yükü yok ve kullanıcı Word'de
 * metni düzenlediğinde hizalama bozulmaz.
 */
const RIGHT_TAB = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    // Alt kenarlık, HTML şablonundaki `border-bottom` ile aynı görsel dili kurar.
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 2 } },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: BODY_SIZE,
        font: FONT,
        characterSpacing: 20, // twip cinsinden harf aralığı
      }),
    ],
  });
}

/** "Rol — Şirket, Konum ............ Tarih" satırı. */
function entryLine(role: string, org: string, location: string, dates: string): Paragraph {
  const children = [
    new TextRun({ text: role, bold: true, size: BODY_SIZE, font: FONT }),
    new TextRun({ text: ` — ${org}`, size: BODY_SIZE, font: FONT }),
  ];
  if (location) {
    children.push(
      new TextRun({ text: `, ${location}`, italics: true, size: BODY_SIZE, font: FONT }),
    );
  }
  children.push(new TextRun({ text: `\t${dates}`, size: BODY_SIZE - 2, font: FONT, color: "555555" }));

  return new Paragraph({ tabStops: RIGHT_TAB, spacing: { before: 120, after: 20 }, children });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 60 },
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
  });
}

function buildChildren(cv: CVData): Paragraph[] {
  const out: Paragraph[] = [];

  // --- Başlık bloğu ---
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: cv.name.toUpperCase(),
          bold: true,
          size: NAME_SIZE,
          font: FONT,
          characterSpacing: 30,
        }),
      ],
    }),
  );

  if (cv.headerLines.length) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: cv.headerLines.join(" · "),
            size: BODY_SIZE + 1,
            font: FONT,
            color: "444444",
          }),
        ],
      }),
    );
  }

  if (cv.contactLines.length) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: cv.contactLines.join("  ·  "),
            size: BODY_SIZE - 2,
            font: FONT,
            color: "555555",
          }),
        ],
      }),
    );
  }

  // --- Bölümler ---
  // Her bölüm boşsa hiç basılmaz; boş başlık CV'yi zayıf gösterir.
  out.push(sectionHeading("Profesyonel Özet"), body(cv.summary));

  if (cv.experience.length) {
    out.push(sectionHeading("Deneyim"));
    for (const e of cv.experience) {
      out.push(entryLine(e.title, e.company, e.location, e.dates));
      for (const b of e.bullets) out.push(bullet(b));
    }
  }

  if (cv.projects.length) {
    out.push(sectionHeading("Projeler"));
    for (const p of cv.projects) {
      out.push(
        new Paragraph({
          spacing: { before: 120, after: 20 },
          children: [new TextRun({ text: p.title, bold: true, size: BODY_SIZE, font: FONT })],
        }),
        body(p.description),
      );
      if (p.tech.length) {
        out.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: "Teknolojiler: ", bold: true, size: BODY_SIZE - 2, font: FONT }),
              new TextRun({
                text: p.tech.join(", "),
                size: BODY_SIZE - 2,
                font: FONT,
                color: "555555",
              }),
            ],
          }),
        );
      }
    }
  }

  if (cv.education.length) {
    out.push(sectionHeading("Eğitim"));
    for (const e of cv.education) {
      out.push(entryLine(e.degree, e.institution, e.location, e.dates));
    }
  }

  if (cv.skillCategories.length) {
    out.push(sectionHeading("Beceriler"));
    for (const s of cv.skillCategories) {
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${s.category}: `, bold: true, size: BODY_SIZE, font: FONT }),
            new TextRun({ text: s.items.join(", "), size: BODY_SIZE, font: FONT }),
          ],
        }),
      );
    }
  }

  if (cv.languages.length) {
    out.push(sectionHeading("Diller"), body(cv.languages.join(" · ")));
  }

  for (const extra of cv.additionalSections) {
    out.push(sectionHeading(extra.heading));
    for (const item of extra.items) out.push(bullet(item));
  }

  return out;
}

export async function buildDocx(cv: CVData): Promise<Buffer> {
  try {
    const section: ISectionOptions = {
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(16),
            bottom: convertMillimetersToTwip(16),
            left: convertMillimetersToTwip(15),
            right: convertMillimetersToTwip(15),
          },
        },
      },
      children: buildChildren(cv),
    };

    const doc = new Document({
      creator: "Resume Tailor",
      title: `${cv.name} — CV`,
      sections: [section],
    });

    // Packer, docx nesne ağacını gerçek bir .docx (zip'lenmiş OOXML) dosyasına çevirir.
    return await Packer.toBuffer(doc);
  } catch (cause) {
    throw new RenderError("Word dosyası üretilemedi.", { cause });
  }
}

/* ═══════════════════════════════════════════════════════════
   ÖN YAZI (cover letter) -> .docx

   CV builder'ıyla aynı dosyada duruyor çünkü aynı sabitleri
   (FONT, BODY_SIZE) ve aynı Word ölçü birimi mantığını paylaşıyor.
   Ayrı dosyaya alsaydık bu sabitleri ya kopyalamak ya da üçüncü bir
   "ortak" dosya açmak gerekirdi — ikisi de bu boyutta gereksiz.
   ═══════════════════════════════════════════════════════════ */

function letterParagraph(text: string, opts: { bold?: boolean; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 200, line: 320 }, // line: satır aralığı (twip)
    children: [new TextRun({ text, size: 22, font: FONT, bold: opts.bold })],
  });
}

export async function buildLetterDocx(letter: LetterData): Promise<Buffer> {
  try {
    const children: Paragraph[] = [
      new Paragraph({
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 6 } },
        children: [
          new TextRun({
            text: letter.name.toUpperCase(),
            bold: true,
            size: 34,
            font: FONT,
            characterSpacing: 20,
          }),
        ],
      }),
    ];

    if (letter.contactLines.length) {
      children.push(
        new Paragraph({
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: letter.contactLines.join("  ·  "),
              size: 19,
              font: FONT,
              color: "555555",
            }),
          ],
        }),
      );
    }

    if (letter.subject.trim()) children.push(letterParagraph(letter.subject, { bold: true }));

    children.push(letterParagraph(letter.greeting, { after: 240 }));
    for (const p of letter.paragraphs) children.push(letterParagraph(p));
    children.push(letterParagraph(letter.closing, { after: 400 }));
    children.push(letterParagraph(letter.name, { bold: true, after: 0 }));

    const doc = new Document({
      creator: "Resume Tailor",
      title: `${letter.name} — Ön Yazı`,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertMillimetersToTwip(25),
                bottom: convertMillimetersToTwip(25),
                left: convertMillimetersToTwip(22),
                right: convertMillimetersToTwip(22),
              },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  } catch (cause) {
    throw new RenderError("Ön yazı Word dosyası üretilemedi.", { cause });
  }
}

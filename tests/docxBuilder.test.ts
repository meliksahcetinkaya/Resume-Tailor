import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CVDataSchema } from "../src/schemas/cvSchema.ts";
import { buildDocx } from "../src/services/docxBuilder.ts";

const cv = CVDataSchema.parse({
  name: "Ayşe Yılmaz",
  headerLines: ["Backend Developer"],
  contactLines: ["ayse@eposta.com", "İstanbul"],
  summary: "Ölçeklenebilir servisler geliştiren backend geliştirici.",
  experience: [
    {
      title: "Developer",
      company: "Acme",
      location: "İstanbul",
      dates: "2022 – Halen",
      bullets: ["Sipariş servisini yazdı.", "Sorguları indeksleyerek hızlandırdı."],
    },
  ],
  skillCategories: [{ category: "Diller", items: ["TypeScript", "SQL"] }],
  additionalSections: [{ heading: "Sertifikalar", items: ["AWS CP (2024)"] }],
});

describe("buildDocx", () => {
  it("geçerli bir .docx (zip) üretir", async () => {
    const buffer = await buildDocx(cv);

    assert.ok(buffer.length > 1000, "dosya beklenenden küçük");
    // .docx aslında zip'lenmiş bir XML paketidir; her zip "PK" ile başlar.
    assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
  });

  it("bölümü olmayan minimum CV'de de çökmez", async () => {
    const minimal = CVDataSchema.parse({ name: "Ali Veli", summary: "Geliştirici." });
    const buffer = await buildDocx(minimal);
    assert.ok(buffer.length > 1000);
  });
});

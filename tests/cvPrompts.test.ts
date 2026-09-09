import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUserPrompt, formatProfile } from "../src/prompts/cvPrompts.ts";
import { ProfileSchema } from "../src/schemas/requestSchema.ts";

const profile = ProfileSchema.parse({
  fullName: "Ayşe Yılmaz",
  contact: "ayse@eposta.com\nİstanbul",
  experience: [
    {
      title: "Developer",
      company: "Acme",
      dates: "2022 – Halen",
      description: "Sipariş servisini yazdım.",
    },
  ],
  skills: "TypeScript, SQL",
});

describe("formatProfile", () => {
  it("dolu alanları başlıklarıyla yazar", () => {
    const text = formatProfile(profile);
    assert.match(text, /AD SOYAD: Ayşe Yılmaz/);
    assert.match(text, /DENEYİM:/);
    assert.match(text, /BECERİLER:/);
  });

  /**
   * Boş alanların prompt'a girmemesi bilinçli: modele "bu alan boş"
   * gürültüsü göndermek hem token harcar hem de modeli boşluğu
   * doldurmaya (uydurmaya) teşvik eder.
   */
  it("boş alanların başlığını hiç yazmaz", () => {
    const text = formatProfile(profile);
    assert.ok(!text.includes("EĞİTİM:"));
    assert.ok(!text.includes("PROJELER:"));
    assert.ok(!text.includes("EK BİLGİLER:"));
  });
});

describe("buildUserPrompt", () => {
  it("aday bilgilerini ve ilanı ayrı bölümler halinde birleştirir", () => {
    const prompt = buildUserPrompt(profile, "Node.js geliştirici aranıyor.");
    assert.match(prompt, /=== ADAY BİLGİLERİ ===/);
    assert.match(prompt, /=== İŞ İLANI ===/);
    assert.match(prompt, /Node\.js geliştirici aranıyor\./);
  });
});

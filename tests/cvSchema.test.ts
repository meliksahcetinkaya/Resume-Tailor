import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CVDataSchema } from "../src/schemas/cvSchema.ts";

/**
 * Bu testler şemanın İKİ işini de doğruluyor:
 *   - doğrulama (bozuk veriyi reddet),
 *   - normalizasyon (eksik dizileri boş dizi yap).
 * İkincisi kritik: render katmanının hiç `undefined` görmeyeceği garantisi
 * buradan geliyor. Bu garanti kırılırsa docx/pdf üretimi çöker.
 */

const minimal = {
  name: "Ayşe Yılmaz",
  summary: "Backend geliştirici.",
};

describe("CVDataSchema", () => {
  it("eksik dizileri boş dizi olarak doldurur", () => {
    const cv = CVDataSchema.parse(minimal);

    assert.deepEqual(cv.education, []);
    assert.deepEqual(cv.experience, []);
    assert.deepEqual(cv.projects, []);
    assert.deepEqual(cv.skillCategories, []);
    assert.deepEqual(cv.languages, []);
    assert.deepEqual(cv.additionalSections, []);
    assert.deepEqual(cv.headerLines, []);
    assert.deepEqual(cv.contactLines, []);
  });

  it("deneyimde eksik location alanını boş string yapar", () => {
    const cv = CVDataSchema.parse({
      ...minimal,
      experience: [
        { title: "Developer", company: "Acme", dates: "2022 – Halen", bullets: ["Bir şey yaptı."] },
      ],
    });

    assert.equal(cv.experience[0]?.location, "");
  });

  it("boş isim kabul etmez", () => {
    const result = CVDataSchema.safeParse({ ...minimal, name: "" });
    assert.equal(result.success, false);
  });

  it("maddesiz deneyim kabul etmez", () => {
    const result = CVDataSchema.safeParse({
      ...minimal,
      experience: [{ title: "Developer", company: "Acme", dates: "2022", bullets: [] }],
    });
    assert.equal(result.success, false);
  });

  it("yanlış tipteki alanı reddeder", () => {
    const result = CVDataSchema.safeParse({ ...minimal, languages: "Türkçe" });
    assert.equal(result.success, false);
  });
});

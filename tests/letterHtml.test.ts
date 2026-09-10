import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LetterDataSchema } from "../src/schemas/letterSchema.ts";
import { renderLetterHtml } from "../src/services/letterHtml.ts";

const letter = LetterDataSchema.parse({
  name: "Ayşe Yılmaz",
  contactLines: ["ayse@eposta.com", "İstanbul"],
  greeting: "Sayın İnsan Kaynakları Yetkilisi,",
  subject: "Backend Developer pozisyonu başvurusu",
  paragraphs: ["Bu pozisyona başvurmak istiyorum.", "Node.js ile servis geliştirdim."],
  closing: "Saygılarımla,",
});

describe("renderLetterHtml", () => {
  it("tam bir HTML dokümanı üretir", () => {
    const html = renderLetterHtml(letter);
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<\/html>$/);
  });

  it("Türkçe karakterleri bozmadan basar", () => {
    assert.match(renderLetterHtml(letter), /Ayşe Yılmaz/);
  });

  it("her paragrafı ayrı <p> olarak basar", () => {
    const html = renderLetterHtml(letter);
    const count = (html.match(/<p>/g) ?? []).length;
    assert.equal(count, letter.paragraphs.length);
  });

  it("adı hem başlıkta hem imzada kullanır", () => {
    const html = renderLetterHtml(letter);
    assert.equal((html.match(/Ayşe Yılmaz/g) ?? []).length >= 2, true);
  });

  /**
   * GÜVENLİK REGRESYON TESTİ.
   *
   * cvHtml.ts'in aynısı burada da olmalı: mektup metni LLM'den geliyor ve
   * önizleme iframe'ine basılıyor. escapeHtml çağrısı bir gün silinirse
   * sessiz bir XSS açığı doğar — bu test o kapıyı kapalı tutar.
   */
  it("veriden gelen script etiketini çalıştırılabilir halde basmaz", () => {
    const evil = LetterDataSchema.parse({
      ...letter,
      name: '<script>alert("xss")</script>',
      paragraphs: ['<img src=x onerror="alert(1)">'],
    });
    const html = renderLetterHtml(evil);

    assert.ok(!html.includes("<script>alert"), "kaçırılmamış script etiketi bulundu");
    assert.ok(!html.includes("<img src=x"), "kaçırılmamış img etiketi bulundu");
    assert.match(html, /&lt;script&gt;/);
  });

  it("konu satırı boşsa hiç basmaz", () => {
    const noSubject = LetterDataSchema.parse({ ...letter, subject: "" });
    assert.ok(!renderLetterHtml(noSubject).includes('class="subject"'));
  });
});

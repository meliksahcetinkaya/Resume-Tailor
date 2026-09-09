import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CVDataSchema } from "../src/schemas/cvSchema.ts";
import { escapeHtml, renderCvHtml } from "../src/services/cvHtml.ts";

const cv = CVDataSchema.parse({
  name: "Ayşe Yılmaz",
  summary: "Backend geliştirici.",
  experience: [
    {
      title: "Developer",
      company: "Acme",
      dates: "2022 – Halen",
      bullets: ["Sipariş servisini yazdı."],
    },
  ],
});

describe("escapeHtml", () => {
  it("HTML özel karakterlerini kaçırır", () => {
    assert.equal(escapeHtml(`<b>&"'`), "&lt;b&gt;&amp;&quot;&#39;");
  });
});

describe("renderCvHtml", () => {
  it("tam bir HTML dokümanı üretir", () => {
    const html = renderCvHtml(cv);
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<\/html>$/);
  });

  it("Türkçe karakterleri bozmadan basar", () => {
    assert.match(renderCvHtml(cv), /Ayşe Yılmaz/);
  });

  /**
   * Güvenlik regresyon testi: kullanıcı ya da LLM verisi HTML'e ham
   * gömülürse önizleme iframe'inde script çalışabilir (XSS).
   * Bu test o kapının kapalı kaldığını garanti eder.
   */
  it("veriden gelen script etiketini çalıştırılabilir halde basmaz", () => {
    const evil = CVDataSchema.parse({
      ...cv,
      name: '<script>alert("xss")</script>',
    });
    const html = renderCvHtml(evil);

    assert.ok(!html.includes("<script>alert"), "kaçırılmamış script etiketi bulundu");
    assert.match(html, /&lt;script&gt;/);
  });

  it("boş bölümlerin başlığını hiç basmaz", () => {
    const html = renderCvHtml(cv);
    assert.ok(!html.includes("Projeler"), "boş proje bölümü basılmamalı");
    assert.ok(html.includes("Deneyim"), "dolu deneyim bölümü basılmalı");
  });
});

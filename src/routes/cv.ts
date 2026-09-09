import { Router } from "express";
import { GenerateCvRequestSchema, RenderRequestSchema } from "../schemas/requestSchema.ts";
import { renderCvHtml } from "../services/cvHtml.ts";
import { buildDocx } from "../services/docxBuilder.ts";
import { generateCv } from "../services/llm.ts";
import { buildPdf } from "../services/pdfBuilder.ts";
import { MOCK_LLM } from "../config.ts";

/**
 * ROUTE KATMANI — sadece HTTP bilir.
 *
 * Buradaki her handler üç şey yapar ve fazlasını yapmaz:
 *   1. Gelen gövdeyi doğrula (Zod),
 *   2. İlgili servisi çağır (servis HTTP'den habersizdir),
 *   3. Sonucu HTTP cevabına çevir (status, header, gövde).
 *
 * İş mantığı buraya sızmamalı. Sızarsa, o mantığı ancak bir HTTP sunucusu
 * ayağa kaldırarak test edebilirsin — ki bu hem yavaş hem kırılgandır.
 *
 * Handler'lar `async` ve try/catch YOK: Express 5, reddedilen promise'i
 * otomatik olarak errorHandler'a iletir.
 */

const router = Router();

/**
 * Türkçe karakterli dosya adları için Content-Disposition başlığı.
 *
 * HTTP başlıkları tarihsel olarak sadece ASCII taşır. "Ayşe Yılmaz.pdf"
 * doğrudan yazılırsa bazı tarayıcılarda bozulur. RFC 5987 çözümü:
 * ASCII bir yedek (`filename`) ve UTF-8 kodlanmış gerçek ad (`filename*`)
 * birlikte gönderilir; modern tarayıcılar ikincisini tercih eder.
 */
function contentDisposition(fullName: string, ext: string): string {
  const base = fullName.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_") || "CV";
  const filename = `${base}_CV.${ext}`;
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Arayüzün "mock modda mısın?" diye sorabilmesi için küçük bir uç nokta. */
router.get("/health", (_req, res) => {
  res.json({ ok: true, mockLlm: MOCK_LLM });
});

/**
 * POST /api/generate-cv
 * Gövde: { profile, jobPosting }
 * Cevap: { cvData }
 *
 * Bu uç nokta DOSYA ÜRETMEZ. Neden? Çünkü LLM adımı yavaştır (saniyeler),
 * dosya render'ı ise hızlı ve deterministiktir. İkisini ayırınca:
 *   - kullanıcı indirmeden önce CV'yi görüp düzeltebilir,
 *   - bir formatı yeniden üretmek için LLM'e tekrar gidilmez (para/kota),
 *   - cevap gövdesi base64 dosyalarla şişmez.
 */
router.post("/generate-cv", async (req, res) => {
  const { profile, jobPosting } = GenerateCvRequestSchema.parse(req.body);
  const cvData = await generateCv(profile, jobPosting);
  res.json({ cvData });
});

/**
 * POST /api/preview
 * Gövde: { cvData }  →  Cevap: text/html
 *
 * PDF ile BİREBİR aynı `renderCvHtml` fonksiyonunu kullanır; bu yüzden
 * önizlemede gördüğün şey indireceğin PDF'in aynısıdır.
 */
router.post("/preview", (req, res) => {
  const { cvData } = RenderRequestSchema.parse(req.body);
  res.type("html").send(renderCvHtml(cvData));
});

router.post("/render/docx", async (req, res) => {
  const { cvData } = RenderRequestSchema.parse(req.body);
  const buffer = await buildDocx(cvData);
  res
    .type("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    .setHeader("Content-Disposition", contentDisposition(cvData.name, "docx"));
  res.send(buffer);
});

router.post("/render/pdf", async (req, res) => {
  const { cvData } = RenderRequestSchema.parse(req.body);
  const buffer = await buildPdf(cvData);
  res.type("application/pdf").setHeader("Content-Disposition", contentDisposition(cvData.name, "pdf"));
  res.send(buffer);
});

export default router;

import puppeteer, { type Browser } from "puppeteer";
import { RenderError } from "../errors.ts";
import type { CVData } from "../schemas/cvSchema.ts";
import { renderCvHtml } from "./cvHtml.ts";
import { renderLetterHtml } from "./letterHtml.ts";
import type { LetterData } from "../schemas/letterSchema.ts";

/**
 * CVData -> PDF.
 *
 * NEDEN PUPPETEER (yani gerçek bir tarayıcı motoru)?
 * Alternatif, PDF'i "flowable" API'lerle (pdfkit, reportlab tarzı) elle
 * çizmekti. İki sorunu var:
 *   1. Türkçe/Unicode: bu kütüphanelerin gömülü fontları İ, Ğ, Ş gibi
 *      karakterleri desteklemez; TTF dosyasını elle kaydetmen gerekir.
 *      Chrome ise Unicode'u ve sistem fontlarını doğal olarak destekler.
 *   2. Tasarım hızı: sayfa düzenini CSS ile yazmak, kutuları koordinatla
 *      konumlandırmaktan kat kat hızlı ve esnek.
 * Bedeli: ~150MB'lık bir Chromium indirmesi ve her render'da bir tarayıcı
 * sekmesi maliyeti. Bu takas bizim için değer.
 */

/**
 * Tarayıcıyı istek başına açmıyoruz.
 *
 * `puppeteer.launch()` yaklaşık 0.5–1 saniye sürer. Her PDF isteğinde bunu
 * ödemek, üretimin kendisinden uzun sürebilir. Onun yerine tek bir tarayıcı
 * örneğini tembel açıp paylaşıyoruz; her istek sadece yeni bir SEKME açıyor
 * (milisaniyeler). Sekmeler birbirinden yalıtıktır, bu yüzden güvenlidir.
 *
 * Promise'i cache'liyoruz (Browser'ı değil): aynı anda gelen iki istek
 * iki tarayıcı başlatmasın diye.
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      })
      .catch((cause: unknown) => {
        // Başlatma başarısızsa cache'i temizle ki sonraki istek tekrar denesin;
        // aksi halde kalıcı olarak bozuk bir promise'e takılı kalırdık.
        browserPromise = null;
        throw new RenderError(
          "Chromium başlatılamadı. `npx puppeteer browsers install chrome` komutunu çalıştırmayı dene.",
          { cause },
        );
      });
  }
  return browserPromise;
}

/**
 * Herhangi bir HTML dokümanını PDF'e basar.
 *
 * CV ve ön yazı aynı işi yapıyor — sadece HTML'leri farklı. Bu yüzden
 * Puppeteer mantığı burada TEK kez yazılıyor; aşağıdaki iki fonksiyon
 * yalnızca hangi şablonun çağrılacağına karar veriyor.
 */
async function htmlToPdf(html: string, label: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // setContent, HTML'i doğrudan sekmeye yazar — geçici dosyaya veya
    // yerel bir HTTP sunucusuna ihtiyaç yok. HTML'imiz kendi kendine
    // yeter (CSS gömülü, dış kaynak yok), bu yüzden ağ beklemesi de yok.
    await page.setContent(html, { waitUntil: "load" });

    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      // Kenar boşluklarını CSS'teki @page kuralı yönetiyor.
      preferCSSPageSize: true,
    });
    return Buffer.from(bytes);
  } catch (cause) {
    throw new RenderError(`${label} PDF olarak üretilemedi.`, { cause });
  } finally {
    // Sekme her durumda kapanmalı; yoksa bellek sızdırırız.
    await page.close().catch(() => {});
  }
}

export function buildPdf(cv: CVData): Promise<Buffer> {
  return htmlToPdf(renderCvHtml(cv), "CV");
}

export function buildLetterPdf(letter: LetterData): Promise<Buffer> {
  return htmlToPdf(renderLetterHtml(letter), "Ön yazı");
}

/** Sunucu kapanırken tarayıcı sürecini de kapat (bkz. server.ts). */
export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  await pending.then((b) => b.close()).catch(() => {});
}

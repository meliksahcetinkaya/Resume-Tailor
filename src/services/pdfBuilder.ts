import puppeteer, { type Browser } from "puppeteer";
import { RenderError } from "../errors.ts";
import type { CVData } from "../schemas/cvSchema.ts";
import { renderCvHtml } from "./cvHtml.ts";

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

export async function buildPdf(cv: CVData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // setContent, HTML'i doğrudan sekmeye yazar — geçici dosyaya veya
    // yerel bir HTTP sunucusuna ihtiyaç yok. HTML'imiz tamamen kendi
    // kendine yeter (CSS gömülü, dış kaynak yok), bu yüzden ağ beklemesi de yok.
    await page.setContent(renderCvHtml(cv), { waitUntil: "load" });

    const bytes = await page.pdf({
      format: "A4",
      // CSS'teki @page kuralı kenar boşluklarını yönetiyor.
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(bytes);
  } catch (cause) {
    throw new RenderError("PDF üretilemedi.", { cause });
  } finally {
    // Sekme her durumda kapanmalı; yoksa bellek sızdırırız.
    await page.close().catch(() => {});
  }
}

/** Sunucu kapanırken tarayıcı sürecini de kapat (bkz. server.ts). */
export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  await pending.then((b) => b.close()).catch(() => {});
}

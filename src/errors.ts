/**
 * Uygulama içi hata tipi.
 *
 * Neden düz `throw new Error(...)` yetmiyor? Çünkü merkezi hata middleware'inin
 * "bu hata kullanıcıya 400 mü 502 mi dönmeli?" sorusuna cevap vermesi gerekiyor.
 * Bunu mesaj metnini okuyup tahmin ederek yapmak kırılgan olur; hatanın kendisi
 * bu bilgiyi taşısın.
 *
 * `expose` alanı, mesajın kullanıcıya gösterilmesinin güvenli olup olmadığını
 * söyler. Beklenmeyen hataların iç detayları (dosya yolları, SDK stack'leri)
 * istemciye sızmamalı.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly expose: boolean;
  readonly details: unknown;

  constructor(
    message: string,
    options: { statusCode?: number; expose?: boolean; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.expose = options.expose ?? this.statusCode < 500;
    this.details = options.details;
  }
}

/** LLM çağrısı ya da çıktısının doğrulanması başarısız olduğunda. */
export class LlmError extends AppError {
  constructor(message: string, options: { details?: unknown; cause?: unknown } = {}) {
    // 502: hata bizde değil, yukarı akıştaki serviste (ya da onun çıktısında).
    super(message, { statusCode: 502, expose: true, ...options });
    this.name = "LlmError";
  }
}

/** Dosya (docx/pdf) üretimi başarısız olduğunda. */
export class RenderError extends AppError {
  constructor(message: string, options: { details?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 500, expose: true, ...options });
    this.name = "RenderError";
  }
}

/* Resume Tailor — arayüz mantığı (vanilla JS, build adımı yok).
 *
 * Sorumlulukları:
 *   1. Tekrarlanabilir form satırlarını (deneyim/eğitim/proje) yönetmek,
 *   2. Formu toplayıp /api/generate-cv'ye göndermek,
 *   3. Dönen cvData'yı /api/preview ile iframe'de göstermek,
 *   4. İndirme butonlarını /api/render/* uçlarına bağlamak.
 *
 * Uygulamanın "tek gerçeği" aşağıdaki `state.cvData`. Önizleme de,
 * indirilen Word/PDF de HEP bu nesneden üretilir — bu yüzden JSON'u
 * elle düzeltince üç çıktı da birlikte değişir.
 */

const state = {
  /** @type {object|null} */
  cvData: null,
};

const STORAGE_KEY = "resume-tailor:profile";

/* ─────────────── Tekrarlanabilir grup tanımları ─────────────── */

const GROUPS = {
  experience: {
    singular: "deneyim",
    fields: [
      { name: "title", label: "Pozisyon", placeholder: "Backend Developer" },
      { name: "company", label: "Şirket", placeholder: "Örnek Teknoloji A.Ş." },
      { name: "dates", label: "Tarih", placeholder: "2022 – Halen" },
      {
        name: "description",
        label: "Ne yaptın?",
        full: true,
        rows: 3,
        placeholder:
          "Sipariş servisini yazdım, raporlama sorguları çok yavaştı indeksleyip hızlandırdım, ekipte 4 kişiydik…",
      },
    ],
  },
  education: {
    singular: "eğitim",
    fields: [
      { name: "degree", label: "Derece / Bölüm", placeholder: "Bilgisayar Mühendisliği, Lisans" },
      { name: "institution", label: "Kurum", placeholder: "Örnek Üniversitesi" },
      { name: "dates", label: "Tarih", placeholder: "2018 – 2022" },
    ],
  },
  projects: {
    singular: "proje",
    fields: [
      { name: "title", label: "Proje adı", placeholder: "Stok Takip Paneli" },
      {
        name: "description",
        label: "Kısaca ne yapıyor?",
        full: true,
        rows: 2,
        placeholder:
          "Depo stoklarını gerçek zamanlı izleyen web uygulaması. React arayüz, Node.js API ve PostgreSQL kullandım.",
      },
    ],
  },
};

/* ─────────────── DOM yardımcıları ─────────────── */

const $ = (id) => document.getElementById(id);

/**
 * Alanları DOM API'siyle kuruyoruz, innerHTML ile değil.
 * Neden? innerHTML'e değişken gömmek alışkanlık haline gelirse er ya da geç
 * kullanıcı verisi de oraya girer ve XSS açığı doğar. textContent/property
 * ataması bu riski baştan ortadan kaldırır.
 */
function makeField(groupName, field) {
  const wrap = document.createElement("label");
  wrap.className = "field";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = field.label;
  wrap.appendChild(label);

  const input = field.full
    ? document.createElement("textarea")
    : document.createElement("input");
  if (field.full) input.rows = field.rows ?? 2;
  else input.type = "text";

  input.placeholder = field.placeholder ?? "";
  input.dataset.field = field.name;
  input.dataset.group = groupName;
  wrap.appendChild(input);

  return wrap;
}

function makeItem(groupName) {
  const def = GROUPS[groupName];
  const item = document.createElement("div");
  item.className = "item";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.textContent = "kaldır";
  remove.addEventListener("click", () => {
    item.remove();
    refreshEmptyNotes();
    saveProfile();
  });
  item.appendChild(remove);

  const inline = def.fields.filter((f) => !f.full);
  const full = def.fields.filter((f) => f.full);

  if (inline.length) {
    const row = document.createElement("div");
    row.className = inline.length >= 3 ? "row-3" : "row-2";
    for (const f of inline) row.appendChild(makeField(groupName, f));
    item.appendChild(row);
  }
  for (const f of full) item.appendChild(makeField(groupName, f));

  return item;
}

function addItem(groupName, values) {
  const item = makeItem(groupName);
  $(`${groupName}Items`).appendChild(item);
  if (values) {
    for (const input of item.querySelectorAll("[data-field]")) {
      input.value = values[input.dataset.field] ?? "";
    }
  }
  refreshEmptyNotes();
  return item;
}

/** Grup boşsa kullanıcıya ne yapacağını söyle — boş alan bir davettir. */
function refreshEmptyNotes() {
  for (const groupName of Object.keys(GROUPS)) {
    const container = $(`${groupName}Items`);
    const has = container.querySelector(".item") !== null;
    let note = container.querySelector(".empty-note");
    if (has) {
      note?.remove();
    } else if (!note) {
      note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = `Henüz ${GROUPS[groupName].singular} eklemedin.`;
      container.appendChild(note);
    }
  }
}

/* ─────────────── Form ↔ veri ─────────────── */

function collectProfile() {
  const readGroup = (groupName) =>
    [...$(`${groupName}Items`).querySelectorAll(".item")].map((item) => {
      const obj = {};
      for (const input of item.querySelectorAll("[data-field]")) {
        obj[input.dataset.field] = input.value.trim();
      }
      return obj;
    });

  return {
    fullName: $("fullName").value.trim(),
    contact: $("contact").value.trim(),
    experience: readGroup("experience"),
    education: readGroup("education"),
    projects: readGroup("projects"),
    skills: $("skills").value.trim(),
    languages: $("languages").value.trim(),
    extra: $("extra").value.trim(),
  };
}

function applyProfile(profile) {
  $("fullName").value = profile.fullName ?? "";
  $("contact").value = profile.contact ?? "";
  $("skills").value = profile.skills ?? "";
  $("languages").value = profile.languages ?? "";
  $("extra").value = profile.extra ?? "";

  for (const groupName of Object.keys(GROUPS)) {
    $(`${groupName}Items`).replaceChildren();
    for (const values of profile[groupName] ?? []) addItem(groupName, values);
  }
  refreshEmptyNotes();
}

/**
 * PROFİLİ tarayıcıda saklıyoruz — iş ilanını DEĞİL.
 *
 * Neden bu ayrım? Profil (ad, deneyim, eğitim, beceriler) nadiren değişir;
 * kullanıcı onu bir kez doldurup her başvuruda yeniden kullanmalı. İş ilanı
 * ise her başvuruda başkadır — kaydedilseydi kullanıcı her seferinde eski
 * ilanı silmek zorunda kalırdı.
 *
 * Veri sunucuya gitmez, yalnızca bu tarayıcıda kalır. try/catch şart:
 * gizli sekmede veya site verisi kapalıyken localStorage hata fırlatabilir.
 */
function saveProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectProfile()));
  } catch {
    /* saklama başarısız olursa uygulama yine de çalışmalı */
  }
}

/** Kayıtlı profil varsa forma doldurur. İş ilanı kutusu boş kalır. */
function restoreProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    applyProfile(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

/* ─────────────── Sunucu iletişimi ─────────────── */

/** Hata gövdesini okunur tek bir mesaja indirger. */
async function readError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* JSON değilse aşağıdaki genel mesaja düşeriz */
  }
  if (!payload?.error) return `Sunucu hatası (${response.status}).`;

  const details = Array.isArray(payload.details)
    ? payload.details
        .map((d) => (typeof d === "string" ? d : `${d.field}: ${d.message}`))
        .join("\n")
    : "";
  return details ? `${payload.error}\n${details}` : payload.error;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

/* ─────────────── Prova (önizleme) ─────────────── */

function showStage(which) {
  $("emptyState").hidden = which !== "empty";
  $("busyState").hidden = which !== "busy";
  $("preview").hidden = which !== "preview";
}

async function refreshPreview() {
  if (!state.cvData) return;
  const response = await postJson("/api/preview", { cvData: state.cvData });
  // srcdoc + sandbox: iframe içeriği ayrı bir origin'de ve script çalıştıramaz.
  // Sunucudaki HTML kaçırmasının üstüne ikinci bir savunma katmanı.
  $("preview").srcdoc = await response.text();
  showStage("preview");
}

function setCvData(cvData) {
  state.cvData = cvData;
  $("jsonEditor").value = JSON.stringify(cvData, null, 2);
  $("jsonPanel").hidden = false;
  $("docxBtn").disabled = false;
  $("pdfBtn").disabled = false;
}

/* ─────────────── İndirme ─────────────── */

async function download(kind, button) {
  if (!state.cvData) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "hazırlanıyor…";
  try {
    const response = await postJson(`/api/render/${kind}`, { cvData: state.cvData });
    const blob = await response.blob();

    // Sunucunun Content-Disposition'ında gönderdiği adı okuyoruz;
    // dosya adı mantığı tek bir yerde (sunucuda) yaşasın diye.
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="([^"]+)"/i.exec(disposition);
    const filename = utf8
      ? decodeURIComponent(utf8[1])
      : (plain?.[1] ?? `CV.${kind}`);

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Belleği hemen bırakmıyoruz; bazı tarayıcılar indirmeyi
    // başlatmadan URL iptal edilirse dosyayı boş kaydediyor.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    showError($("formError"), error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/* ─────────────── Hata gösterimi ─────────────── */

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = "";
  element.hidden = true;
}

/* ─────────────── Olay bağlantıları ─────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  for (const button of document.querySelectorAll("[data-add]")) {
    button.addEventListener("click", () => {
      const group = button.dataset.add;
      addItem(group).querySelector("[data-field]")?.focus();
      saveProfile();
    });
  }

  // Kayıtlı profil varsa doldur ve kullanıcıya haber ver; yoksa her gruba
  // birer boş satır koy ki "nereye yazacağım?" diye düşünmesin.
  if (restoreProfile()) {
    $("savedNote").hidden = false;
  } else {
    addItem("experience");
    addItem("education");
    addItem("projects");
  }
  refreshEmptyNotes();

  // Her tuş vuruşunda tüm formu serileştirmek gereksiz iş; 400 ms
  // yazmayı bekleyip bir kez kaydediyoruz (debounce).
  // İlan kutusu hariç: o kaydedilmiyor, boşuna yazma yapmayalım.
  let saveTimer;
  document.addEventListener("input", (event) => {
    if (!event.target.closest("#cvForm")) return;
    if (event.target.id === "jobPosting") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProfile, 400);
  });

  $("cvForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError($("formError"));

    const profile = collectProfile();
    const jobPosting = $("jobPosting").value.trim();

    if (!profile.fullName) {
      showError($("formError"), "Ad soyad alanını doldur.");
      $("fullName").focus();
      return;
    }
    if (jobPosting.length < 20) {
      showError($("formError"), "İş ilanı çok kısa. İlanın tamamını yapıştır.");
      $("jobPosting").focus();
      return;
    }

    const button = $("submitBtn");
    button.disabled = true;
    button.querySelector(".generate-label").textContent = "Oluşturuluyor…";
    document.body.classList.add("is-busy");
    showStage("busy");

    try {
      const response = await postJson("/api/generate-cv", { profile, jobPosting });
      const { cvData } = await response.json();
      setCvData(cvData);
      await refreshPreview();
    } catch (error) {
      showError($("formError"), error.message);
      showStage(state.cvData ? "preview" : "empty");
    } finally {
      button.disabled = false;
      button.querySelector(".generate-label").textContent = "CV oluştur";
      document.body.classList.remove("is-busy");
    }
  });

  $("docxBtn").addEventListener("click", (e) => download("docx", e.currentTarget));
  $("pdfBtn").addEventListener("click", (e) => download("pdf", e.currentTarget));

  $("applyJson").addEventListener("click", async () => {
    clearError($("jsonError"));
    try {
      state.cvData = JSON.parse($("jsonEditor").value);
      await refreshPreview();
    } catch (error) {
      showError(
        $("jsonError"),
        error instanceof SyntaxError ? "JSON geçersiz: " + error.message : error.message,
      );
    }
  });

  /** Üretilmiş CV'yi ve önizlemeyi sıfırlar. Forma dokunmaz. */
  function clearResult() {
    state.cvData = null;
    $("preview").srcdoc = "";
    $("jsonEditor").value = "";
    $("jsonPanel").hidden = true;
    $("docxBtn").disabled = true;
    $("pdfBtn").disabled = true;
    clearError($("formError"));
    showStage("empty");
  }

  // "Yeni ilan": sadece ilan kutusunu ve üretilmiş CV'yi temizler.
  // Profil olduğu gibi kalır — asıl kullanım senaryosu bu:
  // bir kez bilgilerini gir, sonra her ilan için sadece ilanı değiştir.
  $("newJobBtn").addEventListener("click", () => {
    $("jobPosting").value = "";
    clearResult();
    $("jobPosting").focus();
  });

  // "Bilgilerimi sil": profili de dahil her şeyi siler.
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Kayıtlı bilgilerin bu tarayıcıdan tamamen silinecek. Devam edilsin mi?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* yok sayılabilir */
    }
    $("cvForm").reset();
    applyProfile({});
    addItem("experience");
    addItem("education");
    addItem("projects");
    $("savedNote").hidden = true;
    clearResult();
  });

  // Mock modda olup olmadığımızı üst barda göster — sahte CV'yi
  // gerçek sanıp göndermek kötü bir sürpriz olurdu.
  try {
    const health = await (await fetch("/api/health")).json();
    if (health.mockLlm) $("mockBadge").hidden = false;
  } catch {
    /* sunucu erişilemezse rozet gösterme */
  }
});

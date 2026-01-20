/***************************************************************
 * Bitrix24 (OAuth) -> Google Docs CERT GENERATOR (FINAL)
 * 1 документ = 1..4 сотрудников (лицевая/оборотная стороны уже в шаблоне)
 *
 * Шаблон: 17RPQjhkPnedkOo_SPLG22aKeCLhSE6rRZI8XJHcXMZI
 * Папка:  1pNnClBz39AqIHAvAcoKJTN3LiOvC-v3q
 *
 * Placeholders (в шаблоне, для каждого слота 1..4):
 * {{FIO_#}} {{DATE_#}} {{DATE_END_#}} {{PROTOCOL_#}} {{WORK_PLACE_#}}
 * {{POSITION_#}} {{COMMISSION_#}} {{PHOTO_#}}
 ***************************************************************/

const PROP = PropertiesService.getScriptProperties();

/** ====== GOOGLE ====== */
const GOOGLE_TEMPLATE_ID = "17RPQjhkPnedkOo_SPLG22aKeCLhSE6rRZI8XJHcXMZI";
const GOOGLE_OUTPUT_FOLDER_ID = "1pNnClBz39AqIHAvAcoKJTN3LiOvC-v3q";

/** ====== BITRIX CFG (из вашего файла) ====== */
const CFG = {
  PORTAL: "aserqazin.bitrix24.kz",
  ENTITY_TYPE_ID: 1042,

  TIMEZONE: "Asia/Almaty",
  DATE_FORMAT: "dd.MM.yyyy",

  // Названия полей в вашем смарт-процессе (должны совпадать с тем, что в Битриксе)
  FIELD_TITLES: {
    PRINTED: "Удостоверение печаталось",
    FIO: "ФИО",
    DATE: "Дата",
    DATE_END: "Дата срока действия",
    PROTOCOL: "Номер протокола",
    WORKPLACE: "Место работы",
    POSITION: "Должность/специальность",
    COMMISSION: "Фамилия и инициалы председателя комиссии",
    PHOTO: "Фото",
    CERT_NUM: "Номер удостоверения",
  }
};

/** Script Properties keys (как у вас) */
const KEYS = {
  CLIENT_ID: "B24_CLIENT_ID",
  CLIENT_SECRET: "B24_CLIENT_SECRET",
  ACCESS_TOKEN: "B24_ACCESS_TOKEN",
  REFRESH_TOKEN: "B24_REFRESH_TOKEN",
  EXPIRES_AT: "B24_TOKEN_EXPIRES_AT",
  REST_ENDPOINT: "B24_REST_ENDPOINT",
  OAUTH_STATE: "B24_OAUTH_STATE",
  WEBAPP_URL: "WEBAPP_URL"
};

/** ====== WEBAPP ENTRY (для OAuth callback) ====== */
function doGet(e) { return handle_(e, "GET"); }
function doPost(e) { return handle_(e, "POST"); }

function handle_(e, verb) {
  const params = (e && e.parameter) ? e.parameter : {};
  const code = params.code || "";
  const state = params.state || "";

  // OAuth callback
  if (code) {
    const savedState = PROP.getProperty(KEYS.OAUTH_STATE) || "";
    if (!savedState || !state || state !== savedState) {
      return HtmlService.createHtmlOutput(
        "<h3>STATE не совпал</h3><p>Запустите <b>startOAuth()</b> и пройдите авторизацию заново.</p>"
      );
    }

    const token = exchangeCodeForToken_(code);

    if (token.refresh_token) PROP.setProperty(KEYS.REFRESH_TOKEN, token.refresh_token);
    if (token.access_token) PROP.setProperty(KEYS.ACCESS_TOKEN, token.access_token);

    const expiresIn = Number(token.expires_in || 3600);
    const expiresAt = Date.now() + expiresIn * 1000 - 60000;
    PROP.setProperty(KEYS.EXPIRES_AT, String(expiresAt));

    if (token.client_endpoint) {
      PROP.setProperty(KEYS.REST_ENDPOINT, token.client_endpoint);
    } else {
      PROP.setProperty(KEYS.REST_ENDPOINT, "https://" + CFG.PORTAL + "/rest/");
    }

    return HtmlService.createHtmlOutput(
      "<h2>OK</h2><p>Токены сохранены. Запустите <b>testB24Ping()</b>, затем <b>testGenerate()</b>.</p>"
    );
  }

  // обычная страница статуса
  const hasRefresh = !!(PROP.getProperty(KEYS.REFRESH_TOKEN) || "");
  const hasAccess = !!(PROP.getProperty(KEYS.ACCESS_TOKEN) || "");
  const html =
    "<h2>Cert Generator</h2>" +
    "<p>Метод: <b>" + verb + "</b></p>" +
    "<p>Bitrix tokens: " + (hasRefresh ? "refresh ✅" : "refresh ❌") + " / " + (hasAccess ? "access ✅" : "access ❌") + "</p>" +
    "<p>Запуск OAuth: выполните <b>startOAuth()</b> (смотрите ссылку в логах).</p>";
  return HtmlService.createHtmlOutput(html);
}

/** ====== 1) Сохранить client_id / client_secret один раз (из вашего файла) ====== */
function setupCredentialsOnce() {
  const clientId = "local.696986fdebaa25.59124262";
  const clientSecret = "S9tyRWK8GF4xBNOc6PV7rpOwZ8SLHesIjJJESjyEy6pIGnZYVd";

  PROP.setProperty(KEYS.CLIENT_ID, String(clientId).trim());
  PROP.setProperty(KEYS.CLIENT_SECRET, String(clientSecret).trim());
  Logger.log("OK: client_id/client_secret сохранены в Script Properties.");
}

function saveWebAppUrlOnce() {
  const url = ScriptApp.getService().getUrl() || "";
  if (!url) throw new Error("ScriptApp.getService().getUrl() пустой. Сначала Deploy WebApp.");
  PROP.setProperty(KEYS.WEBAPP_URL, url);
  Logger.log("OK: WEBAPP_URL сохранён: " + url);
}

function clearAuth() {
  PROP.deleteProperty(KEYS.ACCESS_TOKEN);
  PROP.deleteProperty(KEYS.REFRESH_TOKEN);
  PROP.deleteProperty(KEYS.EXPIRES_AT);
  PROP.deleteProperty(KEYS.REST_ENDPOINT);
  PROP.deleteProperty(KEYS.OAUTH_STATE);
  Logger.log("OK: токены удалены");
}

/** ====== 2) OAuth start ====== */
function startOAuth() {
  const clientId = getClientId_();
  const redirectUri = getWebAppUrl_(); // строго /exec
  const state = Utilities.getUuid();
  PROP.setProperty(KEYS.OAUTH_STATE, state);

  const url =
    "https://oauth.bitrix.info/oauth/authorize/?" +
    "client_id=" + encodeURIComponent(clientId) +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&state=" + encodeURIComponent(state);

  Logger.log("Откройте ссылку и разрешите доступ:\n" + url);
  return HtmlService.createHtmlOutput(
    "<h3>Откройте ссылку</h3>" +
    "<p><a target='_blank' href='" + url + "'>Авторизация Bitrix</a></p>" +
    "<p>redirect_uri: <code>" + redirectUri + "</code></p>"
  );
}

function exchangeCodeForToken_(code) {
  const url = "https://oauth.bitrix.info/oauth/token/";
  const payload = {
    grant_type: "authorization_code",
    client_id: getClientId_(),
    client_secret: getClientSecret_(),
    code: code,
    redirect_uri: getWebAppUrl_()
  };

  const resp = UrlFetchApp.fetch(url, { method: "post", payload, muteHttpExceptions: true });
  const txt = resp.getContentText();
  if (resp.getResponseCode() !== 200) throw new Error("Token exchange HTTP=" + resp.getResponseCode() + "\n" + txt);

  const j = safeJson_(txt);
  if (!j || !j.access_token) throw new Error("Нет access_token в ответе:\n" + txt);
  return j;
}

function refreshToken_() {
  const refresh = PROP.getProperty(KEYS.REFRESH_TOKEN) || "";
  if (!refresh) throw new Error("Нет refresh_token. Сначала startOAuth() и авторизация.");

  const url = "https://oauth.bitrix.info/oauth/token/";
  const payload = {
    grant_type: "refresh_token",
    client_id: getClientId_(),
    client_secret: getClientSecret_(),
    refresh_token: refresh
  };

  const resp = UrlFetchApp.fetch(url, { method: "post", payload, muteHttpExceptions: true });
  const txt = resp.getContentText();
  if (resp.getResponseCode() !== 200) throw new Error("Refresh HTTP=" + resp.getResponseCode() + "\n" + txt);

  const j = safeJson_(txt);
  if (!j || !j.access_token) throw new Error("Нет access_token после refresh:\n" + txt);

  PROP.setProperty(KEYS.ACCESS_TOKEN, j.access_token);
  if (j.refresh_token) PROP.setProperty(KEYS.REFRESH_TOKEN, j.refresh_token);

  const expiresIn = Number(j.expires_in || 3600);
  const expiresAt = Date.now() + expiresIn * 1000 - 60000;
  PROP.setProperty(KEYS.EXPIRES_AT, String(expiresAt));

  if (j.client_endpoint) PROP.setProperty(KEYS.REST_ENDPOINT, j.client_endpoint);
  return j.access_token;
}

function getAccessToken_() {
  const expiresAt = Number(PROP.getProperty(KEYS.EXPIRES_AT) || "0");
  const token = PROP.getProperty(KEYS.ACCESS_TOKEN) || "";
  if (token && Date.now() < expiresAt) return token;
  return refreshToken_();
}

/** ====== Bitrix REST ====== */
function callB24_(method, params) {
  const token = getAccessToken_();
  const base = PROP.getProperty(KEYS.REST_ENDPOINT) || ("https://" + CFG.PORTAL + "/rest/");
  const url = base + method.replace(/\.json$/i, "") + ".json";

  const body = Object.assign({}, params || {}, { auth: token });

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json; charset=utf-8",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const txt = resp.getContentText();
  const code = resp.getResponseCode();
  const j = safeJson_(txt) || {};

  if (code !== 200) throw new Error("REST HTTP=" + code + "\n" + txt);
  if (j.error) throw new Error("REST error: " + j.error + " / " + (j.error_description || "") + "\n" + txt);

  return { code, txt, json: j };
}

function testB24Ping() {
  const r = callB24_("user.current", {});
  Logger.log(r.txt);
}

/** =================== ГЕНЕРАЦИЯ =================== */
function generateCertificatesGoogleDocs(ids) {
  ids = ids || [60, 58, 56, 54];
  if (!Array.isArray(ids)) throw new Error("ids должен быть массивом: [60,58,56,54]");
  ids = ids.map(x => Number(x)).filter(x => !!x);

  if (ids.length < 1 || ids.length > 4) {
    throw new Error("Можно генерировать от 1 до 4 удостоверений за раз (в одном документе).");
  }

  const fieldMap = resolveFieldMapByTitles_(); // title -> ufCode
  const items = loadItemsByIds_(ids, fieldMap);

  // исключаем уже напечатанные
  const printable = items.filter(it => !isPrinted_(it, fieldMap));
  if (printable.length === 0) {
    throw new Error("Все выбранные удостоверения уже были напечатаны (флаг: " + CFG.FIELD_TITLES.PRINTED + ").");
  }

  // копируем шаблон
  const folder = DriveApp.getFolderById(GOOGLE_OUTPUT_FOLDER_ID);
  const file = DriveApp.getFileById(GOOGLE_TEMPLATE_ID)
    .makeCopy("Удостоверение_" + Utilities.formatDate(new Date(), CFG.TIMEZONE, "yyyyMMdd_HHmm"), folder);

  const doc = DocumentApp.openById(file.getId());
  const body = doc.getBody();

  // слоты 1..4
  for (let slot = 1; slot <= 4; slot++) {
    const item = printable[slot - 1] || null;

    const fio = item ? getFieldValue_(item, fieldMap.FIO) : "";
    const date = item ? formatDate_(getFieldValue_(item, fieldMap.DATE)) : "";
    const dateEnd = item ? formatDate_(getFieldValue_(item, fieldMap.DATE_END)) : "";
    const protocol = item ? getFieldValue_(item, fieldMap.PROTOCOL) : "";
    const work = item ? getFieldValue_(item, fieldMap.WORKPLACE) : "";
    const position = item ? getFieldValue_(item, fieldMap.POSITION) : "";
    const commission = item ? getFieldValue_(item, fieldMap.COMMISSION) : "";
    const certNum = item ? getFieldValue_(item, fieldMap.CERT_NUM) : "";
    
    replace_(body, `{{CERT_NUM_${slot}}}`, certNum);
    replace_(body, `{{FIO_${slot}}}`, fio);
    replace_(body, `{{DATE_${slot}}}`, date);
    replace_(body, `{{DATE_END_${slot}}}`, dateEnd);
    replace_(body, `{{PROTOCOL_${slot}}}`, protocol);

    // ВАЖНО: именно WORK_PLACE как в вашем шаблоне
    replace_(body, `{{WORK_PLACE_${slot}}}`, work);

    replace_(body, `{{POSITION_${slot}}}`, position);
    replace_(body, `{{COMMISSION_${slot}}}`, commission);

    // Фото
    const photoVal = item ? item.raw[fieldMap.PHOTO] : null;
    insertPhoto_(body, `{{PHOTO_${slot}}}`, photoVal);
  }

  doc.saveAndClose();

  // помечаем как напечатанные
  markPrinted_(printable.map(x => x.id), fieldMap);

  return file.getUrl();
}

/** Тестовый запуск */
function testGenerate() {
  const ids = [60, 58, 56, 54];
  const url = generateCertificatesGoogleDocs(ids);
  Logger.log("ГОТОВО: " + url);
}

/** ====== Загрузка элементов по ID ====== */
function loadItemsByIds_(ids, fieldMap) {
  const select = [
    "id",
    fieldMap.PRINTED,
    fieldMap.FIO,
    fieldMap.DATE,
    fieldMap.DATE_END,
    fieldMap.PROTOCOL,
    fieldMap.WORKPLACE,
    fieldMap.POSITION,
    fieldMap.COMMISSION,
    fieldMap.PHOTO,
    fieldMap.CERT_NUM
  ].filter(Boolean);

  const res = callB24_("crm.item.list", {
    entityTypeId: CFG.ENTITY_TYPE_ID,
    filter: { id: ids },
    select,
    order: { id: "asc" }
  });

  const items = (res.json && res.json.result && res.json.result.items) ? res.json.result.items : [];
  return items.map(it => ({ id: Number(it.id), raw: it }));
}

/** ====== Маппинг UF кодов по названию поля (title) ====== */
function resolveFieldMapByTitles_() {
  const res = callB24_("crm.item.fields", { entityTypeId: CFG.ENTITY_TYPE_ID });
  const fields = (res.json && res.json.result && res.json.result.fields) ? res.json.result.fields : {};

  const T = CFG.FIELD_TITLES;

  const out = {
    PRINTED: findFieldCodeByTitle_(fields, T.PRINTED),
    FIO: findFieldCodeByTitle_(fields, T.FIO),
    DATE: findFieldCodeByTitle_(fields, T.DATE),
    DATE_END: findFieldCodeByTitle_(fields, T.DATE_END),
    PROTOCOL: findFieldCodeByTitle_(fields, T.PROTOCOL),
    WORKPLACE: findFieldCodeByTitle_(fields, T.WORKPLACE),
    POSITION: findFieldCodeByTitle_(fields, T.POSITION),
    COMMISSION: findFieldCodeByTitle_(fields, T.COMMISSION),
    CERT_NUM: findFieldCodeByTitle_(fields, T.CERT_NUM),


    // Фото не делаем обязательным, но если нашли — вставим
    PHOTO: findFieldCodeByTitle_(fields, T.PHOTO)
  };

  const must = ["PRINTED","FIO","DATE","DATE_END","PROTOCOL","WORKPLACE","POSITION","COMMISSION","CERT_NUM"];
  const missing = must.filter(k => !out[k]);
  if (missing.length) {
    throw new Error(
      "Не найдены поля по названиям в Битрикс24: " + missing.join(", ") +
      ". Проверьте CFG.FIELD_TITLES (названия должны совпадать 1-в-1)."
    );
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function findFieldCodeByTitle_(fieldsObj, title) {
  const t = String(title || "").trim().toLowerCase();
  if (!t) return null;

  for (const code in fieldsObj) {
    const f = fieldsObj[code];
    const ft = String(f && f.title ? f.title : "").trim().toLowerCase();
    if (ft === t) return code;
  }
  return null;
}

/** ====== Printed ====== */
function isPrinted_(item, fieldMap) {
  const v = item && item.raw ? item.raw[fieldMap.PRINTED] : null;
  return String(v || "") === "1" || v === true;
}

function markPrinted_(ids, fieldMap) {
  ids.forEach(id => {
    callB24_("crm.item.update", {
      entityTypeId: CFG.ENTITY_TYPE_ID,
      id: Number(id),
      fields: { [fieldMap.PRINTED]: "1" }
    });
  });
}

/** ====== Replace helpers ====== */
function replace_(body, key, value) {
  body.replaceText(escapeRegex_(key), String(value ?? ""));
}

function escapeRegex_(t) {
  return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ====== Values ====== */
function getFieldValue_(item, code) {
  if (!item || !item.raw || !code) return "";
  const v = item.raw[code];
  if (v === null || typeof v === "undefined") return "";
  return String(v);
}

function formatDate_(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  // Bitrix date чаще YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, CFG.TIMEZONE, CFG.DATE_FORMAT);
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;

  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return Utilities.formatDate(d2, CFG.TIMEZONE, CFG.DATE_FORMAT);

  return s;
}

/** ====== PHOTO вставка ====== */
function insertPhoto_(body, placeholder, ufValue) {
  const found = body.findText(escapeRegex_(placeholder));
  if (!found) return;

  const textEl = found.getElement().asText();
  textEl.setText("");

  const fileId = extractFileId_(ufValue);
  if (!fileId) return; // нет фото

  const blob = downloadB24ItemFileBlob_(fileId);
  if (!blob) return;

  const parent = textEl.getParent();
  const idx = parent.getChildIndex(textEl);

  parent.insertInlineImage(idx + 1, blob)
    .setWidth(85)
    .setHeight(113);
}

function extractFileId_(ufValue) {
  if (!ufValue) return null;

  // бывает массив
  if (Array.isArray(ufValue)) {
    const v = ufValue[0];
    return extractFileId_(v);
  }

  // если объект
  if (typeof ufValue === "object") {
    // иногда хранит id прямо в объекте
    if (ufValue.id) return Number(ufValue.id) || null;
    if (ufValue.fileId) return Number(ufValue.fileId) || null;

    // или возвращает downloadUrl (но нам нужен id — оставим попытку)
    return null;
  }

  // строка/число
  const n = Number(ufValue);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function downloadB24ItemFileBlob_(fileId) {
  // fileId = ID из UF (как у вас 2478)
  const url = `https://${CFG.PORTAL}/bitrix/services/main/ajax.php?action=crm.controller.item.getFile` +
              `&SITE_ID=s1&entityTypeId=${CFG.ENTITY_TYPE_ID}&id=${encodeURIComponent(fileId)}`;

  // Вариант 1: пробуем сразу (часто работает)
  let resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() === 200) return resp.getBlob();

  // Вариант 2: добавляем auth токен (если порталу нужно)
  const token = getAccessToken_();
  const url2 = url + `&auth=${encodeURIComponent(token)}`;

  resp = UrlFetchApp.fetch(url2, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    Logger.log("Фото не скачалось: HTTP=" + resp.getResponseCode() + " url=" + url2);
    return null;
  }
  return resp.getBlob();
}



/** ====== JSON + creds ====== */
function safeJson_(txt) {
  try { return JSON.parse(txt); } catch (_) { return null; }
}

function getClientId_() {
  const id = (PROP.getProperty(KEYS.CLIENT_ID) || "").trim();
  if (!id) throw new Error("Нет B24_CLIENT_ID. Запустите setupCredentialsOnce().");
  return id;
}

function getClientSecret_() {
  const sec = (PROP.getProperty(KEYS.CLIENT_SECRET) || "").trim();
  if (!sec) throw new Error("Нет B24_CLIENT_SECRET. Запустите setupCredentialsOnce().");
  return sec;
}

function getWebAppUrl_() {
  const url1 = ScriptApp.getService().getUrl() || "";
  if (url1) return url1;

  const url2 = (PROP.getProperty(KEYS.WEBAPP_URL) || "").trim();
  if (url2) return url2;

  throw new Error("Не найден URL веб-приложения. Deploy WebApp и/или saveWebAppUrlOnce().");
}

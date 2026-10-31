// Cheburcheck — фоновый сервис-воркер (Manifest V3)
// Проверка доменов/IP на блокировку через API cheburcheck.ru

const API_URL = "https://cheburcheck.ru/api/v1/check?target=";
const SITE_URL = "https://cheburcheck.ru/check?target=";
const MENU_ID = "cheburcheck-check-block";
const ICON = "icons/icon128.png";
const MAX_CHECKS = 10; // сколько последних проверок показывать в popup-окне

// Создаём пункт контекстного меню при установке/обновлении расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Проверить блокировку",
    contexts: ["link", "page"], // по ссылке и на самом сайте (в контексте страницы)
  });
});

// Правый клик → «Проверить блокировку»
chrome.contextMenus.onClicked.addListener((info) => {
  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  let target;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    target = u.hostname; // домен или IP-адрес ссылки/страницы
  } catch {
    return; // mailto:, javascript: и т.п.
  }
  if (!target) return;

  checkTarget(target).catch((err) => console.error("cheburcheck:", err));
});

// Запрос к API cheburcheck.ru и показ результата уведомлением
// (если уведомления недоступны — открываем результат в новой вкладке)
async function checkTarget(target) {
  const notesOk = await showNote(target, {
    title: "Cheburcheck",
    message: `Проверяю ${target}…`,
  });

  try {
    const res = await fetch(API_URL + encodeURIComponent(target));

    if (res.status === 429) {
      throw new Error("превышен лимит запросов к cheburcheck.ru (30 в минуту), попробуйте позже");
    }
    if (res.status === 404) {
      throw new Error(`${target} не найден в базах данных cheburcheck.ru`);
    }
    if (!res.ok) {
      throw new Error(`ошибка API cheburcheck.ru: HTTP ${res.status}`);
    }

    const data = await res.json();
    await renderResult(target, data, notesOk);
  } catch (e) {
    console.error("cheburcheck:", e);
    recordResult(target, null, e.message); // blocked = null → в popup будет «ошибка»
    if (notesOk) {
      await showNote(target, {
        title: "Cheburcheck",
        message: `Не удалось проверить ${target}.\n${e.message}`,
      });
    } else {
      openResultTab(target); // уведомления заблокированы — показываем результат в браузере
    }
  }
}

function openResultTab(target) {
  chrome.tabs.create({ url: SITE_URL + encodeURIComponent(target) });
}

// Сохраняем результат в storage и подсвечиваем иконку расширения,
// чтобы было видно, что есть новый результат (popup открывает клик по иконке)
async function recordResult(target, blocked, details) {
  try {
    const entry = { target, blocked, details, time: Date.now() };
    const { lastChecks = [] } = await chrome.storage.local.get("lastChecks");
    await chrome.storage.local.set({ lastChecks: [entry, ...lastChecks].slice(0, MAX_CHECKS) });

    if (blocked === true) {
      await chrome.action.setBadgeText({ text: "✕" });
      await chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
    } else if (blocked === false) {
      await chrome.action.setBadgeText({ text: "✓" });
      await chrome.action.setBadgeBackgroundColor({ color: "#188038" });
    }
  } catch (e) {
    console.warn("cheburcheck: не удалось сохранить результат:", e);
  }
}

// Формируем текст результата из ответа API
async function renderResult(target, d, notesOk) {
  const lines = [];

  if (d.blocked) {
    if (d.rkn_domain) {
      lines.push(`В списке Роскомнадзора: ${d.rkn_domain}`);
    }
    for (const [provider, subnets] of Object.entries(d.cdn_providers || {})) {
      lines.push(`Заблокированный CDN «${provider}» (${subnets.length} подсетей)`);
    }
    if (!lines.length) lines.push("Найден в списках блокировок");
  } else {
    lines.push("Блокировка не обнаружена (Роскомнадзор и заблокированные CDN)");
  }

  if (d.whitelist) {
    lines.push("Добавлен в белый список cheburcheck.ru");
  }

  await recordResult(target, !!d.blocked, lines.join("\n"));

  if (notesOk) {
    await showNote(target, {
      title: d.blocked
        ? `🚫 ${target} — заблокирован`
        : `✅ ${target} — не заблокирован`,
      message: lines.join("\n"),
      buttons: [{ title: "Открыть на cheburcheck.ru" }],
    });
  }
}

// Создаёт уведомление или обновляет существующее (id = домен, чтобы по клику на кнопку знать, какой сайт открыть).
// Возвращает false, если уведомления недоступны/заблокированы.
async function showNote(id, { title, message, buttons }) {
  const opts = { type: "basic", iconUrl: ICON, title, message };
  if (buttons) opts.buttons = buttons;
  try {
    await chrome.notifications.create(id, opts);
    return true;
  } catch (e) {
    // уведомление с таким id могло уже существовать — пробуем обновить
    try {
      await chrome.notifications.update(id, opts);
      return true;
    } catch (e2) {
      console.warn("cheburcheck: уведомления недоступны:", e2.message || e2);
      return false;
    }
  }
}

// Кнопка «Открыть на cheburcheck.ru» в уведомлении
chrome.notifications.onButtonClicked.addListener((id) => {
  openResultTab(id);
  chrome.notifications.clear(id);
});

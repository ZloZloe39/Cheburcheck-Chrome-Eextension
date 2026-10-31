// Страница отчёта: результат проверки + предпросмотр сайта
const target = new URLSearchParams(location.search).get("target") || "";

const els = {
  domain: document.getElementById("domain"),
  badge: document.getElementById("badge"),
  details: document.getElementById("details"),
  time: document.getElementById("time"),
  noData: document.getElementById("no-data"),
};
const card = document.getElementById("result-card");
const iframe = document.getElementById("preview");

if (target) {
  els.domain.textContent = target;
  document.title = "Cheburcheck — " + target;
  iframe.src = "https://" + target;
} else {
  els.domain.textContent = "(не указан сайт)";
  els.badge.textContent = "—";
  card.querySelector(".dot").remove();
}

// Подтягиваем последний результат для этого сайта из истории
async function loadResult() {
  if (!target) return;
  const { lastChecks = [] } = await chrome.storage.local.get("lastChecks");
  const entry = lastChecks.find((c) => c.target === target);
  if (!entry) return; // остаётся «нет данных в истории»

  els.noData.hidden = true;
  els.details.hidden = false;
  els.details.textContent = entry.details || "(без деталей)";
  els.time.textContent = new Date(entry.time).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  if (entry.blocked === true) {
    card.classList.add("blocked");
    els.badge.textContent = "заблокирован";
  } else if (entry.blocked === false) {
    card.classList.add("ok");
    els.badge.textContent = "не заблокирован";
  } else {
    card.classList.add("err");
    els.badge.textContent = "ошибка";
  }
}
loadResult();

// Кнопки
if (target) {
  document.getElementById("open-site").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://" + target });
  });
  document.getElementById("cc-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://cheburcheck.ru/check?target=" + encodeURIComponent(target) });
  });
} else {
  // без параметра target ничего открывать не нужно
  document.querySelector(".actions").remove();
  iframe.closest(".card").remove();
}
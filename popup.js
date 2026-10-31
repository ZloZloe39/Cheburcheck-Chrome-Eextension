// Popup-окно: список последних проверок из chrome.storage.local
const listEl = document.getElementById("list");

const fmtTime = (t) => new Date(t).toLocaleString("ru-RU", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

async function render() {
  const { lastChecks = [] } = await chrome.storage.local.get("lastChecks");

  if (!lastChecks.length) {
    listEl.innerHTML = '<div class="empty">Пока нет проверок.<br>Правый клик по ссылке → «Проверить блокировку»</div>';
    return;
  }

  const ul = document.createElement("ul");
  for (const c of lastChecks) {
    const cls = c.blocked === true ? "blocked" : c.blocked === false ? "ok" : "err";
    const status = c.blocked === true ? "заблокирован" : c.blocked === false ? "не заблокирован" : "ошибка";

    const li = document.createElement("li");
    li.className = cls;

    const top = document.createElement("div");
    top.className = "top";

    const dot = document.createElement("span");
    dot.className = "dot";

    const a = document.createElement("a");
    a.className = "target";
    a.href = "#";
    a.textContent = c.target;
    a.title = "Открыть отчёт о проверке";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("results.html?target=" + encodeURIComponent(c.target)) });
    });

    const st = document.createElement("span");
    st.className = "status";
    st.textContent = status;

    top.append(dot, a, st);
    li.appendChild(top);

    const d = document.createElement("div");
    d.className = "details";
    d.textContent = (c.details ? c.details + "\n" : "") + fmtTime(c.time);
    li.appendChild(d);

    ul.appendChild(li);
  }
  listEl.innerHTML = "";
  listEl.appendChild(ul);
}

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.remove("lastChecks");
  render();
});

// результат «прочитан» — гасим значок на иконке
chrome.action.setBadgeText({ text: "" });

render();
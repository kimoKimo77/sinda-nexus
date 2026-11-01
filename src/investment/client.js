export const INVESTMENT_CLIENT_JS = String.raw`(() => {
  let token = null;
  const login = document.getElementById("login");
  const workspace = document.getElementById("workspace");
  const form = document.getElementById("loginForm");
  const error = document.getElementById("loginError");
  const marketsNode = document.getElementById("markets");
  const names = {stocks:"الأسهم",crypto:"العملات الرقمية",gold:"الذهب والمعادن",forex:"الفوركس","real-estate":"العقارات"};
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { ...(token ? {authorization:"Bearer " + token} : {}), ...(options.headers || {}) },
      body: options.body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || "تعذر إكمال الطلب.");
    return body;
  }
  function renderSnapshot(card, snapshot) {
    if (!snapshot || snapshot.status !== "available" || !snapshot.data) {
      card.append(element("p", "البيانات غير متاحة حالياً؛ لم يتم تأكيد مصدر موثوق أو تعذر الاتصال به.", "status"));
      return;
    }
    const data = snapshot.data;
    card.append(element("p", "المصدر: " + data.source));
    card.append(element("p", "آخر تحديث: " + new Date(data.asOf).toLocaleString("ar-SA", {timeZone:"Asia/Riyadh"})));
    if (!Array.isArray(data.items) || data.items.length === 0) {
      card.append(element("p", "لا توجد بيانات منشورة لهذا السوق حالياً.", "status"));
      return;
    }
    const list = element("ul");
    for (const item of data.items) {
      const price = Number.isFinite(item.price)
        ? new Intl.NumberFormat("ar-SA", {maximumFractionDigits:8}).format(item.price) + (item.currency ? " " + item.currency : "")
        : "السعر غير متاح";
      const change = Number.isFinite(item.changePercent) ? " · التغير " + item.changePercent + "%" : "";
      list.append(element("li", (item.name || item.symbol) + " (" + item.symbol + "): " + price + change));
    }
    card.append(list);
  }
  async function loadMarkets() {
    const result = await api("/api/v1/investment/markets");
    const markets = Array.isArray(result.markets) ? result.markets : [];
    marketsNode.replaceChildren();
    login.classList.add("hidden");
    workspace.classList.remove("hidden");
    for (const market of markets) {
      const card = element("article", undefined, "market");
      card.append(element("h3", market.name || names[market.id] || market.id));
      card.append(element("p", market.description || ""));
      card.append(element("p", "جارٍ تحميل بيانات السوق…", "status"));
      marketsNode.append(card);
      try {
        const snapshot = await api("/api/v1/investment/markets/" + encodeURIComponent(market.id));
        card.querySelector(".status")?.remove();
        renderSnapshot(card, snapshot);
      } catch {
        card.querySelector(".status")?.remove();
        card.append(element("p", "تعذر جلب بيانات هذا السوق حالياً.", "status"));
      }
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    const data = new FormData(form);
    try {
      const result = await api("/api/v1/auth/login", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({email:data.get("email"),password:data.get("password")})
      });
      token = result.token;
      await loadMarkets();
      form.reset();
    } catch (cause) {
      token = null;
      error.textContent = cause.message;
    }
  });
  document.getElementById("logout").addEventListener("click", () => {
    token = null;
    marketsNode.replaceChildren();
    workspace.classList.add("hidden");
    login.classList.remove("hidden");
    error.textContent = "تم إنهاء جلسة العرض.";
  });
})();`;
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
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || "تعذر إكمال الطلب.");
    return body;
  }
  function renderMarkets(markets) {
    marketsNode.replaceChildren();
    for (const market of markets) {
      const card = element("article", undefined, "market");
      card.append(element("h3", market.name || names[market.id] || market.id));
      card.append(element("p", market.description || ""));
      card.append(element("p", "مصدر البيانات غير مربوط — لا توجد أسعار معروضة.", "status"));
      marketsNode.append(card);
    }
  }
  async function loadMarkets() {
    const result = await api("/api/v1/investment/markets");
    renderMarkets(result.markets || []);
    login.classList.add("hidden");
    workspace.classList.remove("hidden");
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

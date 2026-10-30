import { prepareEvmTransaction, sendWithMetaMask } from "/wallet-modules/wallet.js";

const $ = (id) => document.getElementById(id);

function showResult(title, message) {
  $("result").hidden = false;
  $("result-title").textContent = title;
  $("result-body").textContent = message;
}
function shortAddress(value) {
  return value ? value.slice(0, 6) + "…" + value.slice(-4) : "";
}
function setWallet(account) {
  $("wallet-status").textContent = account ? "متصل: " + shortAddress(account) : "لم يتم ربط محفظة بعد.";
  $("connect").textContent = account ? "تحديث اتصال المحفظة" : "ربط MetaMask";
}

$("connect").addEventListener("click", async () => {
  try {
    const provider = window.ethereum;
    if (!provider?.request) throw new Error("لم يتم العثور على MetaMask. ثبّت الإضافة وافتحها أولًا.");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || !accounts[0]) throw new Error("لم تتم الموافقة على ربط الحساب.");
    setWallet(accounts[0]);
    showResult("تم ربط المحفظة", "الحساب المتصل: " + accounts[0] + "\nلم يتم إنشاء أو إرسال أي معاملة.");
  } catch (error) {
    showResult("تعذر ربط المحفظة", error?.message || String(error));
  }
});

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", (accounts) => setWallet(accounts?.[0] || null));
  window.ethereum.on("chainChanged", () => {
    showResult("تغيرت الشبكة", "تم تحديث الشبكة في المحفظة. أعد مراجعة المعاملة قبل المتابعة.");
  });
}

$("transaction-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("review");
  button.disabled = true;
  try {
    const network = $("network").value;
    const transaction = {
      to: $("to").value.trim(),
      value: $("value").value.trim(),
      data: $("data").value.trim() || "0x"
    };
    const prepared = prepareEvmTransaction({ network, transaction });
    const networkName = $("network").selectedOptions[0].textContent;
    const confirmed = window.confirm(
      "راجع تفاصيل المعاملة قبل فتح MetaMask:\n\n" +
      "الشبكة: " + networkName + "\n" +
      "المستلم: " + prepared.transaction.to + "\n" +
      "القيمة (Hex Wei): " + prepared.transaction.value + "\n" +
      "البيانات: " + prepared.transaction.data + "\n\n" +
      "سيطلب MetaMask موافقتك النهائية. هل تريد المتابعة؟"
    );
    if (!confirmed) return;
    const result = await sendWithMetaMask({ network, transaction });
    showResult(
      "استلمت المحفظة طلب الإرسال",
      "الشبكة: " + networkName + "\nالحساب: " + result.from +
      "\nرقم المعاملة: " + result.transactionHash +
      "\n\nهذا لا يعني تأكيد المعاملة على البلوكشين. تحقق من حالتها بعد ذلك."
    );
  } catch (error) {
    showResult("لم تكتمل العملية", error?.message || String(error));
  } finally {
    button.disabled = false;
  }
});

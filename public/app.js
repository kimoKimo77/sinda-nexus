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
      "\n\nجارٍ التحقق من المعاملة عبر RPC للقراءة فقط..."
    );
    try {
      let verification;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await fetch("/api/web3/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ network, transactionHash: result.transactionHash })
        });
        const payload = await response.json();
        verification = payload?.data;
        if (!verification) throw new Error(payload?.error || "تعذر قراءة نتيجة RPC");
        const mayBePropagating = verification.status === "unverified" &&
          ["transaction_not_found", "transaction_pending_or_receipt_unavailable"].includes(verification.reason);
        if (!mayBePropagating || attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const statusText = verification.status === "valid"
        ? "مؤكدة بنجاح"
        : verification.status === "invalid"
          ? "فشل التحقق أو رُفضت المعاملة"
          : "غير مؤكدة حتى الآن";
      const details = [
        "حالة RPC: " + statusText,
        "السبب: " + verification.reason,
        verification.blockNumber ? "رقم الكتلة: " + verification.blockNumber : null,
        verification.confirmations !== undefined ? "عدد التأكيدات الحالي: " + verification.confirmations : null
      ].filter(Boolean).join("\n");
      showResult("نتيجة التحقق من المعاملة", "Hash: " + result.transactionHash + "\n" + details);
    } catch (verificationError) {
      showResult(
        "تم استلام Hash — التحقق غير متاح",
        "رقم المعاملة: " + result.transactionHash +
        "\nلم يتمكن الخادم من تأكيد Receipt عبر RPC. " +
        (verificationError?.message || String(verificationError))
      );
    }
  } catch (error) {
    showResult("لم تكتمل العملية", error?.message || String(error));
  } finally {
    button.disabled = false;
  }
});

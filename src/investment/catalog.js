export const INVESTMENT_MARKETS = Object.freeze([
  { id: "stocks", name: "الأسهم", description: "أسهم الشركات والمؤشرات", dataStatus: "provider_not_connected" },
  { id: "crypto", name: "العملات الرقمية", description: "الأصول الرقمية وأسعارها العامة", dataStatus: "provider_not_connected" },
  { id: "gold", name: "الذهب والمعادن", description: "الذهب والمعادن الثمينة", dataStatus: "provider_not_connected" },
  { id: "forex", name: "الفوركس", description: "أزواج العملات وأسعار الصرف", dataStatus: "provider_not_connected" },
  { id: "real-estate", name: "العقارات", description: "مؤشرات وأسعار العقارات المنشورة", dataStatus: "provider_not_connected" }
]);

export const INVESTMENT_RESTRICTIONS = Object.freeze({
  mode: "read-only",
  preview: true,
  financialTransactions: false,
  orderPlacement: false,
  deposits: false,
  withdrawals: false,
  custody: false,
  privateKeyStorage: false,
  brokerConnections: false,
  accountLinking: false,
  automaticTrading: false
});

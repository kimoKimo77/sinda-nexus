# Sinda Nexus

منظومة ذكية وقابلة للتكوين لإدارة المشاريع والملفات والتقارير.

## الهدف

يهدف المشروع إلى توفير أساس آمن ومنظم لإدارة المشاريع ومرفقاتها ومخرجاتها، مع قابلية التوسع لاحقًا وفق نتائج الاختبارات ومتطلبات التشغيل.

## النطاق المبدئي

- إدارة المشاريع ومعلوماتها الأساسية.
- تنظيم الملفات والبيانات الوصفية المرتبطة بالمشاريع.
- إنشاء التقارير ومتابعة حالة الإنجاز.
- واجهات API منظمة وقابلة للاختبار.
- إعدادات عبر متغيرات البيئة، مع عدم تخزين الأسرار في المستودع.
- اختبارات آلية وفحوص أمنية قبل أي نشر.

## الحالة الحالية

هذا الملف هو التوثيق الأولي للمشروع. تُنفّذ الميزات تدريجيًا بعد فحص البنية الفعلية، مع توثيق ما تم تنفيذه وما اجتاز الاختبارات. لا يُفترض وجود تكاملات أو ميزات غير مثبتة في الكود.

## مبادئ التطوير

1. العمل على تغييرات صغيرة قابلة للمراجعة.
2. عدم تضمين مفاتيح API أو كلمات المرور أو بيانات حقيقية في المستودع.
3. التحقق من المدخلات ومعالجة الأخطاء وتطبيق أقل قدر من الصلاحيات.
4. تشغيل الاختبارات والفحوص قبل الدمج أو النشر.
5. عدم الدمج أو النشر إلى الإنتاج دون مراجعة النتائج وموافقة صريحة.

## بدء التطوير

يتطلب التشغيل Node.js 20 أو أحدث. استخدم `npm install` ثم `npm run check` لتشغيل الفحوص والاختبارات المحلية.

## الترخيص

لم يُحدَّد الترخيص بعد. لا تُفترض أذونات إعادة الاستخدام أو التوزيع قبل اختيار ترخيص مناسب.

## Web3 State Validation API (preview)

The isolated branch `feat/web3-state-validation` adds read-only endpoints:

- `POST /api/web3/validate` — validates an EVM transaction hash against a configured RPC network and checks its receipt status.
- `POST /api/web3/hash` — returns a SHA-256 digest for a UTF-8 payload.

Supported networks: Ethereum Mainnet (`ethereum`, chain ID 1), BNB Smart Chain (`bsc`, chain ID 56), and Polygon PoS (`polygon`, chain ID 137).

Configure trusted RPC URLs with `ETHEREUM_RPC_URL`, `BSC_RPC_URL`, and `POLYGON_RPC_URL`. Configure `WEB3_VALIDATION_API_KEY` and send it as `Authorization: Bearer <key>`. Production mode refuses Web3 validation when the API key is missing. Do not commit real credentials.

Example request:

```bash
curl -X POST http://127.0.0.1:3000/api/web3/validate \
  -H "content-type: application/json" \
  -H "authorization: Bearer $WEB3_VALIDATION_API_KEY" \
  -d '{"network":"ethereum","transactionHash":"0x<64-hex-characters>"}'
```

A `valid` result means the RPC provider reported a matching chain, transaction and successful receipt at check time. Confirmations/finality are not calculated. Provider errors, pending transactions, and unavailable data return `unverified`. Bitcoin transaction validation is not included in this iteration. No wallet connection, signing, or transaction submission occurs.

### Live RPC verification (read-only)

Run `npm run rpc:live` to contact public JSON-RPC endpoints (or override them with the three RPC environment variables) and verify each network's reported chain ID and latest block number. The GitHub Actions workflow runs this smoke test separately from the mocked unit tests. This confirms live endpoint connectivity and network identity at test time; it does not validate a user-supplied transaction, establish finality, or guarantee provider availability. The check uses only `eth_chainId` and `eth_blockNumber`; it never connects a wallet or submits a transaction.

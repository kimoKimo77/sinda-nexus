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

## Web3 State Validation API (read-only)

The branch `feat/web3-state-validation` adds read-only endpoints:

- `POST /api/web3/validate` — validates an EVM transaction hash against a configured RPC network and checks its receipt status.
- `POST /api/web3/hash` — returns a SHA-256 digest for a UTF-8 payload.

Supported networks: Ethereum Mainnet (`ethereum`, chain ID 1), BNB Smart Chain (`bsc`, chain ID 56), and Polygon PoS (`polygon`, chain ID 137).

Configure trusted RPC URLs with `ETHEREUM_RPC_URL`, `BSC_RPC_URL`, and `POLYGON_RPC_URL`. Configure `WEB3_VALIDATION_API_KEY` and send it as `Authorization: Bearer <key>`. Production mode refuses Web3 validation when the API key is missing. Do not commit real credentials.

A `valid` result means the RPC provider reported a matching chain, transaction and successful receipt at check time. Confirmations/finality are not calculated. Provider errors, pending transactions, and unavailable data return `unverified`. Bitcoin transaction validation is not included.

### Live RPC verification (read-only)

Run `npm run rpc:live` to contact configured JSON-RPC endpoints and verify each network's reported chain ID and latest block number. The check uses only `eth_chainId` and `eth_blockNumber`; it never connects a wallet or submits a transaction.

## External wallet transaction flow (preview)

The branch `feat/evm-transaction-lifecycle` adds `src/web3/wallet.js`, a browser-side EIP-1193 helper intended to be imported by a browser frontend/bundler. The current repository is an Express API and does not yet contain a frontend page or wallet-connect UI; this helper is not automatically exposed as a web page.

- `prepareEvmTransaction()` validates and normalizes a transaction locally. It does not connect to a wallet, sign, or send anything.
- `sendWithMetaMask()` must be called from an explicit user gesture, such as a click on a clearly labelled review/send button. It requests account access, checks the active chain against the selected network, then calls `eth_sendTransaction`.
- MetaMask displays the final transaction details and performs signing/broadcast only after the user approves inside the wallet. The app never receives or stores a private key.
- A chain mismatch stops before `eth_sendTransaction`. The helper does not silently switch networks or add chains.
- The helper only accepts an explicit recipient address and a restricted set of transaction fields. It rejects unknown fields, malformed quantities/data, and conflicting fee formats.

**Important:** For injected wallets such as MetaMask, `eth_sendTransaction` is the standard user-confirmed wallet operation that signs and broadcasts as one wallet action. The application cannot promise a separately exportable signed raw transaction from MetaMask. A returned transaction hash means the wallet/provider accepted the submission request, not that the transaction is confirmed. Use the read-only validation endpoint or a block explorer to inspect later confirmation.

### Safety and testing boundaries

Automated tests use a mocked EIP-1193 provider. They verify local preparation, account/network checks, and that a network mismatch prevents the send RPC call. They do not unlock a wallet, sign, broadcast, or send a real transaction. Do not use mainnet funds for initial manual testing; use a test network and a dedicated low-value test wallet. Every transaction requires a fresh, explicit approval in the wallet.

No private keys, seed phrases, wallet passwords, or signing secrets belong in this repository, environment variables, API requests, logs, or chat messages. No server-side signing or automatic transaction submission is implemented.

## Remaining integration work

The Express API repository currently has no frontend. A user-facing wallet-connect/review screen must be integrated into the actual frontend application before this helper can be used by end users. Production deployment, PR merge, and any real-network transaction remain separate gated steps requiring review and explicit approval.

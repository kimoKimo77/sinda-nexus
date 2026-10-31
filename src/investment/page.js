export const INVESTMENT_HTML = String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0b1220">
<title>الاستثمار الذكي | Smart Investment AI</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#0b1220;color:#e8eef8}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#1b3150 0,transparent 42%),#0b1220}
main{max-width:1120px;margin:auto;padding:24px 16px 48px}.top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
h1{font-size:clamp(23px,4vw,34px);margin:0}.muted{color:#a7b7cd}.tag{border:1px solid #47617f;border-radius:99px;padding:7px 12px;font-size:12px}
.panel,.market{background:#121f32;border:1px solid #2b405d;border-radius:16px;padding:18px;margin-top:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;margin-top:14px}
.market h3{margin:0 0 8px}.market p{margin:0;line-height:1.7}.status{color:#f0cc87;font-size:13px}
input,button{font:inherit;border-radius:10px;padding:12px;border:1px solid #405673;background:#0c1728;color:#e8eef8;width:100%;margin-top:8px}
button{background:#c49a5a;color:#111827;font-weight:700;border:0;cursor:pointer;max-width:220px}
form{max-width:420px}.hidden{display:none}.notice{border-right:3px solid #c49a5a;padding:10px 13px;background:#18273a;border-radius:8px;line-height:1.8}
footer{padding:24px 2px;color:#9aabc1;font-size:12px;line-height:1.8}
@media(max-width:520px){main{padding:18px 12px 32px}.panel,.market{padding:14px}button{max-width:none}}
</style></head>
<body><main>
<header class="top"><div><h1>الاستثمار الذكي</h1><p class="muted">Smart Investment AI · منصة متابعة وتحليل للقراءة فقط</p></div><span class="tag">Preview · Read-only</span></header>
<section class="panel notice">هذه النسخة للقراءة والتحليل فقط. لا تنفذ صفقات أو تحويلات، ولا تربط حسابات وساطة أو تحفظ مفاتيح خاصة. لن نعرض أسعارًا مختلقة عند غياب مصدر موثوق.</section>
<section id="login" class="panel"><h2>تسجيل الدخول</h2><p class="muted">استخدم حساب مساحة العمل الحالي.</p>
<form id="loginForm"><label>البريد الإلكتروني<input name="email" type="email" autocomplete="username" required></label><label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">دخول آمن</button></form><p id="loginError" class="muted" role="status"></p></section>
<section id="workspace" class="hidden"><div class="panel top"><div><h2>لوحة الأسواق</h2><p class="muted">كتالوج الأسواق وحالة توفر مصادر البيانات.</p></div><button id="logout" type="button">تسجيل الخروج</button></div>
<div id="markets" class="grid" aria-live="polite"></div>
<section class="panel"><h2>حدود التشغيل</h2><p class="muted">لا تداول آلي · لا أوامر شراء أو بيع · لا إيداع أو سحب · لا حفظ أموال أو مفاتيح · لا ربط بحسابات مالية حقيقية.</p></section></section>
<footer>المعلومات والتحليلات ليست توصية استثمارية. الأسعار والمؤشرات لن تظهر إلا بعد ربط مزود بيانات موثوق والتحقق من المصدر والطابع الزمني. لا تعتبر هذه النسخة جاهزة للاستخدام المالي أو الإنتاجي.</footer>
</main><script src="/investment.js" defer></script></body></html>`;

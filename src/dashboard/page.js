export const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SINDA Sovereign Preview</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#0b1220;color:#e7edf7}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#1a2a43 0,transparent 40%),#0b1220}
main{max-width:1100px;margin:auto;padding:28px 18px}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:26px;margin:0}.muted{color:#9fb0c7}.tag{border:1px solid #50617a;border-radius:99px;padding:6px 12px;font-size:12px}
.panel{background:#121e30;border:1px solid #2a3b53;border-radius:16px;padding:20px;margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
input,select,button{font:inherit;border-radius:10px;padding:11px 12px;border:1px solid #40536d;background:#0d1727;color:#e7edf7;width:100%;margin-top:7px}
button{background:#b18a50;color:#111827;font-weight:700;border:0;cursor:pointer}button.secondary{background:#263a55;color:#e7edf7}
form{max-width:420px}.hidden{display:none}.metric{font-size:26px;font-weight:700;margin-top:8px}.item{padding:12px;border:1px solid #2a3b53;border-radius:12px;margin-top:8px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row>*{flex:1}.status{color:#b9d5a4}pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#c4d4e8}
</style></head>
<body><main>
<header class="top"><div><h1>SINDA Sovereign AI</h1><p class="muted">لوحة التحكم السيادية — بيئة Preview</p></div><span class="tag">محاكاة فقط · لا معاملات حقيقية</span></header>
<section id="login" class="panel"><h2>تسجيل الدخول</h2><p class="muted">استخدم حساب مساحة العمل الذي أنشأه المسؤول.</p>
<form id="loginForm"><label>البريد الإلكتروني<input name="email" type="email" autocomplete="username" required></label><label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required></label><button>دخول آمن</button></form><p id="loginError" class="muted"></p></section>
<section id="workspace" class="hidden">
<div class="panel top"><div><h2 id="welcome">مساحة العمل</h2><p class="muted">بيانات المشاريع معزولة حسب عضوية المستخدم.</p></div><button id="logout" class="secondary" style="max-width:130px">تسجيل الخروج</button></div>
<div class="panel"><h2>المشاريع</h2><select id="projects"></select><div id="projectInfo" class="muted"></div></div>
<div class="grid" id="metrics"></div>
<div class="panel"><div class="top"><h2>الوكلاء الافتراضيون</h2><span class="tag">لا تشغيل تلقائي في هذه النسخة</span></div>
<form id="agentForm"><div class="row"><label>اسم الوكيل<input name="name" maxlength="120" required></label><label>النوع<select name="agentType"><option value="planner">مخطط</option><option value="auditor">مدقق</option><option value="builder">منشئ</option><option value="analyst">محلل</option></select></label></div><button>إنشاء وكيل تجريبي</button></form><div id="agents"></div></div>
<div class="panel"><h2>سجل التدقيق الأخير</h2><div id="audit" class="muted"></div></div>
</section>
<footer class="muted" style="padding:22px 4px;font-size:12px">SINDA Preview · لا جمع تبرعات أو حفظ أموال أو مفاتيح أو سك أصول حقيقية أو نشر على الشبكة الرئيسية.</footer>
</main>
<script>
let token=null,activeProject=null;
const el=id=>document.getElementById(id);
async function api(path,options={}){const response=await fetch(path,{...options,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{}),...(options.headers||{})}});const data=await response.json().catch(()=>({error:"تعذر قراءة الاستجابة"}));if(!response.ok)throw new Error(data.error||"فشل الطلب");return data}
function showWorkspace(show){el("login").classList.toggle("hidden",show);el("workspace").classList.toggle("hidden",!show)}
el("loginForm").addEventListener("submit",async event=>{event.preventDefault();el("loginError").textContent="";const form=new FormData(event.currentTarget);try{const result=await api("/api/v1/auth/login",{method:"POST",body:JSON.stringify({email:form.get("email"),password:form.get("password")})});token=result.token;el("welcome").textContent="مرحبًا "+result.user.displayName;showWorkspace(true);await loadProjects()}catch(error){el("loginError").textContent=error.message}});
el("logout").addEventListener("click",()=>{token=null;activeProject=null;showWorkspace(false)});
async function loadProjects(){const data=await api("/api/v1/projects");const select=el("projects");select.replaceChildren();for(const project of data.projects){const option=document.createElement("option");option.value=project.id;option.textContent=project.name+" · "+project.role;select.append(option)}if(!data.projects.length){el("projectInfo").textContent="لا توجد مشاريع متاحة لهذا الحساب.";return}activeProject=select.value;await loadProject()}
el("projects").addEventListener("change",async event=>{activeProject=event.target.value;await loadProject()});
async function loadProject(){if(!activeProject)return;const [dashboard,agents]=await Promise.all([api("/api/v1/projects/"+activeProject+"/dashboard"),api("/api/v1/projects/"+activeProject+"/agents")]);const d=dashboard.dashboard;el("projectInfo").textContent="معرّف المشروع: "+d.projectId+" · صلاحيتك: "+d.role+" · الوضع: "+d.mode;el("metrics").replaceChildren();const counts=d.agentCounts.reduce((sum,item)=>sum+item.count,0);for(const [label,value] of [["إجمالي الوكلاء",counts],["سجلات التدقيق",d.recentAudit.length],["جمع التبرعات","معطل"],["المعاملات المالية","معطلة"]]){const card=document.createElement("div");card.className="panel";const title=document.createElement("div");title.className="muted";title.textContent=label;const metric=document.createElement("div");metric.className="metric";metric.textContent=value;card.append(title,metric);el("metrics").append(card)}el("agents").replaceChildren();for(const agent of agents.agents){const item=document.createElement("div");item.className="item";item.textContent=agent.name+" · "+agent.agent_type+" · "+agent.status;el("agents").append(item)}el("audit").replaceChildren();for(const entry of d.recentAudit){const item=document.createElement("div");item.className="item";item.textContent=entry.event_type+" · "+new Date(entry.created_at).toLocaleString("ar");el("audit").append(item)}}
el("agentForm").addEventListener("submit",async event=>{event.preventDefault();if(!activeProject)return;const form=new FormData(event.currentTarget);try{await api("/api/v1/projects/"+activeProject+"/agents",{method:"POST",body:JSON.stringify({name:form.get("name"),agentType:form.get("agentType")})});event.currentTarget.reset();await loadProject()}catch(error){el("agents").textContent=error.message}});
</script></body></html>`;

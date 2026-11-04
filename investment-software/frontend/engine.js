export const CATEGORIES = ["applications","websites","forums","stores","social"];
export const STATUSES = ["draft","active","review"];
export const STORAGE_KEY = "sinda.demo.projects.v1";
export const seedProjects = [
 {id:"app-001",name:"SINDA Workspace",category:"applications",status:"active",description:"لوحة إدارة المنتجات الرقمية",updatedAt:"2026-11-04"},
 {id:"app-002",name:"Market Insights",category:"applications",status:"review",description:"تحليلات سوق تجريبية",updatedAt:"2026-11-03"},
 {id:"web-001",name:"SINDA Corporate",category:"websites",status:"active",description:"الموقع التعريفي للمنظومة",updatedAt:"2026-11-02"},
 {id:"forum-001",name:"Builders Community",category:"forums",status:"draft",description:"مجتمع تجريبي للنقاشات",updatedAt:"2026-11-01"},
 {id:"store-001",name:"Digital Catalog",category:"stores",status:"review",description:"كتالوج وطلبات اختبارية دون دفع",updatedAt:"2026-10-31"},
 {id:"social-001",name:"SINDA Content Plan",category:"social",status:"draft",description:"تقويم محتوى ومسودات محلية",updatedAt:"2026-10-30"}
];
const copy = value => JSON.parse(JSON.stringify(value));
export function validateProject(input){
 const errors=[];
 if(!input || typeof input!=="object") return ["Invalid project data"];
 if(typeof input.name!=="string" || input.name.trim().length<2) errors.push("Name must contain at least 2 characters");
 if(input.name?.trim().length>80) errors.push("Name must be 80 characters or fewer");
 if(!CATEGORIES.includes(input.category)) errors.push("Unknown category");
 if(!STATUSES.includes(input.status)) errors.push("Unknown status");
 if(typeof input.description!=="string" || input.description.length>500) errors.push("Description must be 500 characters or fewer");
 return errors;
}
export function createProject(input, now=new Date()){
 const errors=validateProject(input); if(errors.length) throw new Error(errors.join("; "));
 return {id:"p-"+now.getTime().toString(36)+"-"+Math.random().toString(36).slice(2,7),name:input.name.trim(),category:input.category,status:input.status,description:input.description.trim(),updatedAt:now.toISOString().slice(0,10)};
}
export function updateProject(projects,id,patch){
 const index=projects.findIndex(p=>p.id===id); if(index<0) throw new Error("Project not found");
 const next={...projects[index],...patch,updatedAt:new Date().toISOString().slice(0,10)};
 const errors=validateProject(next); if(errors.length) throw new Error(errors.join("; "));
 return projects.map((p,i)=>i===index?next:p);
}
export function deleteProject(projects,id){return projects.filter(p=>p.id!==id);}
export function queryProjects(projects,{category="all",status="all",search=""}={}){
 const q=search.trim().toLocaleLowerCase();
 return projects.filter(p=>(category==="all"||p.category===category)&&(status==="all"||p.status===status)&&(!q||[p.name,p.description,p.category].join(" ").toLocaleLowerCase().includes(q)));
}
export function summarize(projects){
 return {total:projects.length,active:projects.filter(p=>p.status==="active").length,draft:projects.filter(p=>p.status==="draft").length,review:projects.filter(p=>p.status==="review").length,byCategory:Object.fromEntries(CATEGORIES.map(c=>[c,projects.filter(p=>p.category===c).length]))};
}
export function loadProjects(storage=globalThis.localStorage){
 try{const raw=storage?.getItem(STORAGE_KEY);if(!raw)return copy(seedProjects);const data=JSON.parse(raw);if(!Array.isArray(data))return copy(seedProjects);return data.filter(p=>validateProject(p).length===0&&typeof p.id==="string");}catch{return copy(seedProjects);}
}
export function saveProjects(projects,storage=globalThis.localStorage){
 if(!Array.isArray(projects)) throw new Error("Projects must be an array");
 storage?.setItem(STORAGE_KEY,JSON.stringify(projects)); return projects.length;
}
export function exportProjects(projects){return JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),projects},null,2);}
export function importProjects(json){
 const parsed=JSON.parse(json);const list=Array.isArray(parsed)?parsed:parsed.projects;
 if(!Array.isArray(list)) throw new Error("Import file must contain a projects array");
 const errors=list.flatMap((p,i)=>validateProject(p).map(e=>"Row "+(i+1)+": "+e));
 if(errors.length) throw new Error(errors.join("\n"));
 return list.map((p,i)=>({...p,id:typeof p.id==="string"?p.id:"import-"+i}));
}

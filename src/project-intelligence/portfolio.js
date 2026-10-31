const STATUS = new Set(["idea", "discovery", "planned", "in_progress", "blocked", "preview", "pilot", "production", "archived", "external_unverified"]);
const STAGES = new Set(["concept", "validation", "prototype", "mvp", "pilot", "scale"]);
const EVIDENCE_TYPES = new Set(["problem_validation", "market_research", "customer_interviews", "prototype_demo", "traction", "business_model", "unit_economics", "legal_ip", "team", "security_review", "financial_model"]);
const PRIORITY_FIELDS = ["userImpact", "strategicFit", "readiness", "urgency", "evidenceStrength"];

function boundedScore(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new TypeError(field + " must be an integer from 0 to 5.");
  }
  return value;
}

function safeText(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new TypeError(field + " must be a non-empty string up to " + max + " characters.");
  }
  return value.trim();
}

export function validateProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) throw new TypeError("Project must be an object.");
  const id = safeText(project.id, "id", 80);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) throw new TypeError("Project id contains unsupported characters.");
  const status = safeText(project.status, "status", 40);
  const stage = safeText(project.stage, "stage", 40);
  if (!STATUS.has(status)) throw new TypeError("Unsupported project status.");
  if (!STAGES.has(stage)) throw new TypeError("Unsupported project stage.");
  const evidence = Array.isArray(project.evidence) ? project.evidence.map((item) => {
    if (!item || typeof item !== "object" || !EVIDENCE_TYPES.has(item.type)) throw new TypeError("Unsupported evidence type.");
    return { type: item.type, reference: safeText(item.reference, "evidence.reference", 300), verified: item.verified === true };
  }) : [];
  const scores = {};
  for (const field of PRIORITY_FIELDS) scores[field] = boundedScore(project.priority?.[field] ?? 0, "priority." + field);
  const dependencies = Array.isArray(project.dependencies) ? project.dependencies.map((item) => safeText(item, "dependency", 80)) : [];
  const risks = Array.isArray(project.risks) ? project.risks.map((item) => safeText(item, "risk", 300)) : [];
  return {
    id,
    name: safeText(project.name, "name", 160),
    description: safeText(project.description, "description", 2000),
    repository: project.repository == null ? null : safeText(project.repository, "repository", 300),
    category: safeText(project.category, "category", 80),
    status,
    stage,
    sourceConfidence: project.sourceConfidence === "verified" ? "verified" : "unverified",
    priority: scores,
    evidence,
    dependencies,
    risks
  };
}

export function scoreProjectPriority(project) {
  const normalized = validateProject(project);
  const weights = { userImpact: 0.30, strategicFit: 0.25, readiness: 0.20, urgency: 0.15, evidenceStrength: 0.10 };
  const score = Object.entries(weights).reduce((total, [key, weight]) => total + normalized.priority[key] * 20 * weight, 0);
  return { score: Math.round(score), band: score >= 75 ? "high" : score >= 50 ? "medium" : "low" };
}

export function assessInvestorReadiness(project) {
  const normalized = validateProject(project);
  const required = ["problem_validation", "market_research", "prototype_demo", "business_model", "unit_economics", "legal_ip", "team", "security_review"];
  const verified = new Set(normalized.evidence.filter((item) => item.verified).map((item) => item.type));
  const checks = required.map((type) => ({ type, complete: verified.has(type) }));
  const completed = checks.filter((item) => item.complete).length;
  const score = Math.round((completed / required.length) * 100);
  const blockers = checks.filter((item) => !item.complete).map((item) => item.type);
  const eligibleForInvestorReview = score === 100 && normalized.sourceConfidence === "verified" && normalized.status !== "external_unverified";
  return {
    score,
    completed,
    total: required.length,
    eligibleForInvestorReview,
    label: eligibleForInvestorReview ? "evidence_complete_review_required" : score >= 50 ? "in_progress" : "not_ready",
    missingEvidence: blockers,
    disclaimer: "This is an evidence checklist, not investment advice, a valuation, a securities offer, or a guarantee of funding."
  };
}

export function findPotentialDuplicates(projects) {
  if (!Array.isArray(projects)) throw new TypeError("projects must be an array.");
  const groups = new Map();
  for (const raw of projects) {
    const project = validateProject(raw);
    const nameKey = project.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const repoKey = project.repository?.toLowerCase();
    for (const key of [nameKey && "name:" + nameKey, repoKey && "repo:" + repoKey].filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(project.id);
    }
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([matchKey, ids]) => ({ matchKey, projectIds: [...ids].sort() }));
}

export function buildPortfolioSnapshot(projects) {
  if (!Array.isArray(projects)) throw new TypeError("projects must be an array.");
  const normalized = projects.map(validateProject);
  const ids = new Set();
  for (const project of normalized) {
    if (ids.has(project.id)) throw new TypeError("Duplicate project id: " + project.id);
    ids.add(project.id);
  }
  const rows = normalized.map((project) => ({
    ...project,
    priorityAssessment: scoreProjectPriority(project),
    investorReadiness: assessInvestorReadiness(project)
  })).sort((a, b) => b.priorityAssessment.score - a.priorityAssessment.score || a.name.localeCompare(b.name));
  return {
    total: rows.length,
    verified: rows.filter((item) => item.sourceConfidence === "verified").length,
    unverified: rows.filter((item) => item.sourceConfidence !== "verified").length,
    byStatus: Object.fromEntries([...STATUS].map((status) => [status, rows.filter((item) => item.status === status).length])),
    duplicateCandidates: findPotentialDuplicates(rows),
    projects: rows
  };
}

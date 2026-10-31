import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProject,
  scoreProjectPriority,
  assessInvestorReadiness,
  findPotentialDuplicates,
  buildPortfolioSnapshot
} from "../src/project-intelligence/portfolio.js";

function project(overrides = {}) {
  return {
    id: "kiom",
    name: "kiom",
    description: "Lightweight task and project productivity application.",
    repository: "https://github.com/kimoKimo77/kiom",
    category: "productivity",
    status: "planned",
    stage: "concept",
    sourceConfidence: "verified",
    priority: { userImpact: 4, strategicFit: 4, readiness: 2, urgency: 3, evidenceStrength: 1 },
    evidence: [],
    dependencies: [],
    risks: [],
    ...overrides
  };
}

test("validates and normalizes a project record", () => {
  const result = validateProject(project());
  assert.equal(result.id, "kiom");
  assert.equal(result.priority.userImpact, 4);
});

test("rejects unsafe identifiers, unknown statuses, and out-of-range scores", () => {
  assert.throws(() => validateProject(project({ id: "../secret" })), /unsupported characters/);
  assert.throws(() => validateProject(project({ status: "deployed_without_review" })), /Unsupported project status/);
  assert.throws(() => validateProject(project({ priority: { userImpact: 6 } })), /0 to 5/);
});

test("scores priority deterministically and returns a band", () => {
  assert.deepEqual(scoreProjectPriority(project()), { score: 63, band: "medium" });
});

test("investor readiness requires verified evidence for every gate", () => {
  const result = assessInvestorReadiness(project({
    evidence: [{ type: "problem_validation", reference: "research/interviews.md", verified: true }]
  }));
  assert.equal(result.score, 13);
  assert.equal(result.eligibleForInvestorReview, false);
  assert.equal(result.missingEvidence.length, 7);
});

test("complete evidence does not bypass unverified project provenance", () => {
  const evidence = ["problem_validation", "market_research", "prototype_demo", "business_model", "unit_economics", "legal_ip", "team", "security_review"]
    .map((type) => ({ type, reference: "evidence/" + type, verified: true }));
  const result = assessInvestorReadiness(project({ evidence, sourceConfidence: "unverified" }));
  assert.equal(result.score, 100);
  assert.equal(result.eligibleForInvestorReview, false);
});

test("allows investor review only when all evidence and provenance gates pass", () => {
  const evidence = ["problem_validation", "market_research", "prototype_demo", "business_model", "unit_economics", "legal_ip", "team", "security_review"]
    .map((type) => ({ type, reference: "evidence/" + type, verified: true }));
  assert.equal(assessInvestorReadiness(project({ evidence })).eligibleForInvestorReview, true);
});

test("detects possible duplicate names and repository references", () => {
  const a = project();
  const b = project({ id: "kiom-copy", name: "KIOM!!!", repository: "https://github.com/kimoKimo77/kiom" });
  const matches = findPotentialDuplicates([a, b]);
  assert.equal(matches.length, 2);
});

test("builds portfolio counts, priority ordering, and rejects duplicate IDs", () => {
  const snapshot = buildPortfolioSnapshot([project(), project({
    id: "vision-digital",
    name: "Vision Digital",
    repository: "https://github.com/kimoKimo77/vision-digital",
    category: "digital-agency",
    status: "preview",
    stage: "mvp",
    priority: { userImpact: 5, strategicFit: 5, readiness: 4, urgency: 3, evidenceStrength: 3 }
  })]);
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.verified, 2);
  assert.equal(snapshot.projects[0].id, "vision-digital");
  assert.throws(() => buildPortfolioSnapshot([project(), project()]), /Duplicate project id/);
});

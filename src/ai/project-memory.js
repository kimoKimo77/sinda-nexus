import { randomUUID } from "node:crypto";

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(field + " is required.");
  return value.trim();
}

export class InMemoryProjectMemory {
  #entries = [];

  async remember({ projectId, content, source = "user", tags = [] } = {}) {
    const entry = {
      id: randomUUID(),
      projectId: requiredText(projectId, "projectId"),
      content: requiredText(content, "content"),
      source: requiredText(source, "source"),
      tags: Array.isArray(tags) ? tags.filter(x => typeof x === "string").slice(0, 20) : [],
      createdAt: new Date().toISOString()
    };
    this.#entries.push(entry);
    return structuredClone(entry);
  }

  async search({ projectId, query = "", limit = 10 } = {}) {
    const scope = requiredText(projectId, "projectId");
    const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    return this.#entries
      .filter(item => item.projectId === scope)
      .map(item => ({ item, score: terms.filter(term => item.content.toLowerCase().includes(term) || item.tags.some(tag => tag.toLowerCase().includes(term))).length }))
      .filter(row => !terms.length || row.score > 0)
      .sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt))
      .slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)))
      .map(row => structuredClone(row.item));
  }

  async list(projectId) {
    return this.#entries.filter(item => item.projectId === projectId).map(item => structuredClone(item));
  }
}

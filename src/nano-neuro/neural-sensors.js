const SENSOR_TYPES = new Set(["motion", "pressure", "thermal", "pulse"]);

export class VirtualSensorHub {
  #counts = new Map();

  constructor({ registry, maxEventsPerAgent = 1000 } = {}) {
    if (!registry || typeof registry.get !== "function") throw new TypeError("Agent registry is required");
    if (!Number.isSafeInteger(maxEventsPerAgent) || maxEventsPerAgent < 1 || maxEventsPerAgent > 10_000) {
      throw new RangeError("Invalid sensor event quota");
    }
    this.registry = registry;
    this.maxEventsPerAgent = maxEventsPerAgent;
  }

  ingest({ agentId, projectId, sensorType, value, timestamp = 0 }) {
    if (typeof agentId !== "string" || !agentId || typeof projectId !== "string" || !projectId) {
      throw new TypeError("Agent and project are required");
    }
    const agent = this.registry.get(agentId);
    if (!agent || agent.projectId !== projectId) throw new Error("Sensor source is not registered in this project");
    if (!SENSOR_TYPES.has(sensorType)) throw new Error("Only allow-listed virtual sensor types are supported");
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) throw new RangeError("Synthetic sensor value is outside bounds");
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new RangeError("Invalid synthetic timestamp");
    const key = `${projectId}\u0000${agentId}`;
    const count = this.#counts.get(key) ?? 0;
    if (count >= this.maxEventsPerAgent) throw new Error("Virtual sensor event quota reached");
    this.#counts.set(key, count + 1);
    return Object.freeze({ source: "virtual", agentId, projectId, sensorType, value, timestamp, sequence: count + 1 });
  }

  count(agentId, projectId) {
    if (typeof agentId !== "string" || typeof projectId !== "string") return 0;
    return this.#counts.get(`${projectId}\u0000${agentId}`) ?? 0;
  }
}

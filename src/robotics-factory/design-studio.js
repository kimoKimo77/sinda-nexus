const MOTION_MODELS = new Set(["biped-walk", "quadruped-trot", "soft-crawl"]);
const SENSOR_TYPES = new Set(["virtual-imu", "virtual-pressure", "virtual-camera"]);
const ACTUATOR_TYPES = new Set(["virtual-joint", "virtual-soft-segment"]);
const MAX_COMPONENTS = 12;
const MAX_NAME = 80;

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}
function boundedText(value, label, max = MAX_NAME) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(`${label} must be a non-empty string of at most ${max} characters.`);
  }
  return value.trim();
}
function components(value, allowed, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_COMPONENTS) {
    throw new RangeError(`${label} must contain 1 to ${MAX_COMPONENTS} virtual components.`);
  }
  const seen = new Set();
  return value.map((item, index) => {
    plainObject(item, `${label}[${index}]`);
    const keys = Object.keys(item);
    if (keys.some(key => !["type", "label"].includes(key))) throw new TypeError(`${label} contains unsupported component fields.`);
    if (!allowed.has(item.type)) throw new TypeError(`${label} contains an unsupported virtual component type.`);
    const labelText = boundedText(item.label, `${label} label`);
    const identity = `${item.type}:${labelText.toLowerCase()}`;
    if (seen.has(identity)) throw new TypeError(`${label} cannot contain duplicate components.`);
    seen.add(identity);
    return Object.freeze({ type: item.type, label: labelText });
  });
}

export function validateRobotDesign(input) {
  plainObject(input, "Robot design");
  const allowed = new Set(["designId", "projectId", "name", "version", "motionModel", "sensors", "actuators", "body"]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new TypeError("Robot design contains unsupported fields.");
  const designId = boundedText(input.designId, "designId", 64);
  const projectId = boundedText(input.projectId, "projectId", 64);
  const name = boundedText(input.name, "name");
  if (!Number.isInteger(input.version) || input.version < 1) throw new RangeError("version must be a positive integer.");
  if (!MOTION_MODELS.has(input.motionModel)) throw new TypeError("Unsupported virtual motion model.");
  const sensors = components(input.sensors, SENSOR_TYPES, "sensors");
  const actuators = components(input.actuators, ACTUATOR_TYPES, "actuators");
  plainObject(input.body, "body");
  if (Object.keys(input.body).some(key => !["massKg", "heightMetres", "widthMetres"].includes(key))) {
    throw new TypeError("Body contains unsupported physical or control fields.");
  }
  const { massKg, heightMetres, widthMetres } = input.body;
  if (!Number.isFinite(massKg) || massKg <= 0 || massKg > 50) throw new RangeError("massKg must be in (0, 50].");
  if (!Number.isFinite(heightMetres) || heightMetres <= 0 || heightMetres > 2) throw new RangeError("heightMetres must be in (0, 2].");
  if (!Number.isFinite(widthMetres) || widthMetres <= 0 || widthMetres > 2) throw new RangeError("widthMetres must be in (0, 2].");
  return Object.freeze({
    designId, projectId, name, version: input.version, motionModel: input.motionModel,
    sensors, actuators,
    body: Object.freeze({ massKg, heightMetres, widthMetres }),
    executionTarget: "virtual-only"
  });
}

export class RobotDesignStudio {
  #projects = new Map();

  create(input, { projectId } = {}) {
    const design = validateRobotDesign(input);
    const scope = boundedText(projectId, "authenticated project scope", 64);
    if (design.projectId !== scope) throw new Error("Project scope mismatch.");
    let records = this.#projects.get(scope);
    if (!records) {
      records = new Map();
      this.#projects.set(scope, records);
    }
    const key = `${design.designId}:v${design.version}`;
    if (records.has(key)) throw new Error("Design version already exists.");
    records.set(key, design);
    return structuredClone(design);
  }

  get(designId, version, { projectId } = {}) {
    const scope = boundedText(projectId, "authenticated project scope", 64);
    const records = this.#projects.get(scope);
    const design = records?.get(`${boundedText(designId, "designId", 64)}:v${version}`);
    if (!design) throw new Error("Design not found in the authenticated project scope.");
    return structuredClone(design);
  }

  list({ projectId } = {}) {
    const scope = boundedText(projectId, "authenticated project scope", 64);
    return [...(this.#projects.get(scope)?.values() ?? [])].map(item => structuredClone(item));
  }
}

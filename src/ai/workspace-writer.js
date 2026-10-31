import path from "node:path";
import { mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { assessAction } from "./policy.js";

export class WorkspaceWriter {
  constructor({ root, auditLog } = {}) {
    if (!root) throw new TypeError("A workspace root is required.");
    this.root = path.resolve(root);
    this.auditLog = auditLog;
  }

  async write(relativePath, content, { approval = false, risk = "low" } = {}) {
    const policy = assessAction({ action: "write", risk, target: relativePath });
    if (policy.decision !== "allow" || approval !== false) {
      throw new Error(policy.decision === "allow" ? "Unexpected approval state." : policy.reason);
    }
    if (typeof content !== "string") throw new TypeError("File content must be a string.");
    const destination = path.resolve(this.root, relativePath);
    if (destination === this.root || !destination.startsWith(this.root + path.sep)) {
      throw new Error("Target path escapes the configured workspace.");
    }
    await mkdir(this.root, { recursive: true });
    const rootReal = await realpath(this.root);
    const parent = path.dirname(destination);
    await mkdir(parent, { recursive: true });
    const parentReal = await realpath(parent);
    if (parentReal !== rootReal && !parentReal.startsWith(rootReal + path.sep)) {
      throw new Error("Target parent resolves outside the configured workspace.");
    }
    const temp = path.join(parentReal, "." + path.basename(destination) + "." + process.pid + "." + Date.now() + ".tmp");
    let handle;
    try {
      handle = await open(temp, "wx", 0o600);
      await handle.writeFile(content, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temp, destination);
      await this.#audit({ event: "workspace.write", target: path.relative(rootReal, destination), bytes: Buffer.byteLength(content), outcome: "success" });
      return { written: true, path: path.relative(rootReal, destination), bytes: Buffer.byteLength(content) };
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await rm(temp, { force: true }).catch(() => {});
      await this.#audit({ event: "workspace.write", target: relativePath, outcome: "failure", error: error.message });
      throw error;
    }
  }

  async #audit(entry) {
    if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at: new Date().toISOString() });
  }
}

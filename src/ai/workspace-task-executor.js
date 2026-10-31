export function createWorkspaceTaskExecutor({ workspaceWriter, handlers = {} } = {}) {
  if (!workspaceWriter || typeof workspaceWriter.write !== "function") throw new TypeError("A guarded workspace writer is required.");
  return async ({ projectId, task, actor }) => {
    if (task.action === "write") {
      return workspaceWriter.write(task.targetPath, task.content, { risk: task.risk });
    }
    const handler = handlers[task.action];
    if (typeof handler !== "function") throw new Error("No trusted handler is configured for action: " + task.action);
    return handler({ projectId, task, actor });
  };
}

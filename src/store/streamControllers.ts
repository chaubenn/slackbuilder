function streamKey(projectId: string, conversationId: string): string {
  return `${projectId}:${conversationId}`;
}

const streamControllers = new Map<string, AbortController>();

export function registerStream(
  projectId: string,
  conversationId: string,
  controller: AbortController,
): void {
  streamControllers.set(streamKey(projectId, conversationId), controller);
}

export function abortStream(projectId: string, conversationId: string): void {
  streamControllers.get(streamKey(projectId, conversationId))?.abort();
  streamControllers.delete(streamKey(projectId, conversationId));
}

export function clearStream(projectId: string, conversationId: string): void {
  streamControllers.delete(streamKey(projectId, conversationId));
}

export function abortAllStreams(): void {
  streamControllers.forEach((controller) => controller.abort());
  streamControllers.clear();
}

export function hasStream(projectId: string, conversationId: string): boolean {
  return streamControllers.has(streamKey(projectId, conversationId));
}

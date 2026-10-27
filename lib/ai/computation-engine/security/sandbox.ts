// lib/ai/computation-engine/security/sandbox.ts

/**
 * Scientia Labs — Computation Engine
 * Bac à sable : environnement d'exécution sécurisé pour les calculs
 */

export class ComputationSandbox {
  private timeoutMs: number;
  private maxMemoryBytes: number;

  constructor(options?: { timeoutMs?: number; maxMemoryBytes?: number }) {
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.maxMemoryBytes = options?.maxMemoryBytes ?? 10 * 1024 * 1024; // 10 MB
  }

  /**
   * Exécute une fonction dans un environnement contrôlé
   * avec timeout et limites de ressources
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await this.withTimeout(fn(), this.timeoutMs);
      const duration = performance.now() - startTime;

      if (duration > this.timeoutMs) {
        throw new SandboxError(
          `Computation timed out after ${this.timeoutMs}ms`
        );
      }

      return result;
    } catch (error) {
      if (error instanceof SandboxError) {
        throw error;
      }
      throw new SandboxError(
        `Computation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Exécute avec un timeout
   */
  private withTimeout<T>(promise: T | Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SandboxError(`Execution exceeded ${ms}ms limit`));
      }, ms);

      Promise.resolve(promise)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Vérifie qu'une chaîne ne dépasse pas la mémoire autorisée
   */
  checkMemoryUsage(input: string): void {
    const bytes = Buffer.byteLength(input, "utf8");
    if (bytes > this.maxMemoryBytes) {
      throw new SandboxError(
        `Input exceeds maximum memory limit of ${this.maxMemoryBytes} bytes`
      );
    }
  }
}

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}
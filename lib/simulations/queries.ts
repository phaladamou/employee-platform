// lib/simulations/queries.ts
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "@/lib/errors";
import {
  type Simulation,
  simulation,
  type UserCategory,
  userCategory,
} from "../db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});
const db = drizzle(client);

// ============ USER CATEGORY ============

export async function getUserCategory(
  userId: string
): Promise<UserCategory | null> {
  try {
    const [result] = await db
      .select()
      .from(userCategory)
      .where(eq(userCategory.userId, userId));
    return result ?? null;
  } catch (_error) {
    console.error("getUserCategory DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user category"
    );
  }
}

export async function setUserCategory(
  userId: string,
  category: string
): Promise<void> {
  try {
    await db
      .insert(userCategory)
      .values({ userId, category, updatedAt: new Date() } as any)
      .onConflictDoUpdate({
        target: userCategory.userId,
        set: { category, updatedAt: new Date() } as any,
      });
  } catch (_error) {
    console.error("setUserCategory DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to set user category"
    );
  }
}

// ============ SIMULATIONS ============

export async function getSimulationsByCategory(
  category: string,
  userId?: string
): Promise<Simulation[]> {
  try {
    const conditions = [eq(simulation.category, category)];
    if (userId) {
      conditions.push(eq(simulation.userId, userId));
    }

    return await db
      .select()
      .from(simulation)
      .where(and(...conditions))
      .orderBy(desc(simulation.updatedAt));
  } catch (_error) {
    console.error("getSimulationsByCategory DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get simulations by category"
    );
  }
}

export async function getSimulationById(
  id: string
): Promise<Simulation | null> {
  try {
    const [result] = await db
      .select()
      .from(simulation)
      .where(eq(simulation.id, id));
    return result ?? null;
  } catch (_error) {
    console.error("getSimulationById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get simulation by id"
    );
  }
}

export async function createSimulation(data: {
  userId: string;
  title: string;
  type: string;
  category: string;
  parameters?: Record<string, unknown>;
  code?: string;
}): Promise<Simulation> {
  try {
    const [result] = await db
      .insert(simulation)
      .values({
        userId: data.userId,
        title: data.title,
        type: data.type,
        category: data.category,
        parameters: data.parameters ?? {},
        code: data.code ?? null,
      } as any)
      .returning();
    return result;
  } catch (_error) {
    console.error("createSimulation DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create simulation"
    );
  }
}

export async function updateSimulation(
  id: string,
  data: {
    title?: string;
    parameters?: Record<string, unknown>;
    code?: string;
    isFavorite?: boolean;
  }
): Promise<void> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.parameters !== undefined) updates.parameters = data.parameters;
    if (data.code !== undefined) updates.code = data.code;
    if (data.isFavorite !== undefined) updates.isFavorite = data.isFavorite;

    await db.update(simulation).set(updates as any).where(eq(simulation.id, id));
  } catch (_error) {
    console.error("updateSimulation DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update simulation"
    );
  }
}

export async function deleteSimulation(id: string): Promise<void> {
  try {
    await db.delete(simulation).where(eq(simulation.id, id));
  } catch (_error) {
    console.error("deleteSimulation DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete simulation"
    );
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    const [sim] = await db
      .select({ isFavorite: simulation.isFavorite })
      .from(simulation)
      .where(eq(simulation.id, id));

    if (!sim) {
      throw new ChatbotError("not_found:database", "Simulation not found");
    }

    const newValue = !sim.isFavorite;
    await db
      .update(simulation)
      .set({ isFavorite: newValue, updatedAt: new Date() } as any)
      .where(eq(simulation.id, id));

    return newValue;
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    console.error("toggleFavorite DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to toggle favorite");
  }
}
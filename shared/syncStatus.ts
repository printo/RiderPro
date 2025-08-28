import { z } from "zod";

// Sync Status Schema
export const syncStatusSchema = z.object({
  shipmentId: z.string(),
  status: z.enum(["pending", "success", "failed"]),
  attempts: z.number().default(0),
  lastAttempt: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
});

export const syncStatsSchema = z.object({
  totalPending: z.number(),
  totalSent: z.number(),
  totalFailed: z.number(),
  lastSyncTime: z.string().optional(),
});

export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type SyncStats = z.infer<typeof syncStatsSchema>;
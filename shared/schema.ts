import { z } from "zod";

// Shipment Schema
export const shipmentSchema = z.object({
  id: z.string(),
  type: z.enum(["delivery", "pickup"]),
  customerName: z.string(),
  customerMobile: z.string(),
  address: z.string(),
  cost: z.number(),
  deliveryTime: z.string(),
  routeName: z.string(),
  employeeId: z.string(),
  status: z.enum(["Assigned", "In Transit", "Delivered", "Picked Up", "Returned", "Cancelled"]).default("Assigned"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const insertShipmentSchema = shipmentSchema.omit({ 
  createdAt: true, 
  updatedAt: true 
});

export const updateShipmentSchema = z.object({
  status: z.enum(["Delivered", "Picked Up", "Returned", "Cancelled"]),
});

export const batchUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    status: z.enum(["Delivered", "Picked Up", "Returned", "Cancelled"]),
  })),
});

// Acknowledgment Schema
export const acknowledgmentSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  signatureUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  capturedAt: z.string(),
});

export const insertAcknowledgmentSchema = acknowledgmentSchema.omit({ 
  id: true 
});

// Dashboard Metrics Schema
export const dashboardMetricsSchema = z.object({
  totalShipments: z.number(),
  completed: z.number(),
  inProgress: z.number(),
  pending: z.number(),
  statusBreakdown: z.record(z.number()),
  typeBreakdown: z.record(z.number()),
  routeBreakdown: z.record(z.object({
    total: z.number(),
    delivered: z.number(),
    pending: z.number(),
    cancelled: z.number(),
  })),
});

// Filter Schema
export const shipmentFiltersSchema = z.object({
  status: z.string().optional(),
  type: z.enum(["delivery", "pickup"]).optional(),
  routeName: z.string().optional(),
  date: z.string().optional(),
});

export type Shipment = z.infer<typeof shipmentSchema>;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type UpdateShipment = z.infer<typeof updateShipmentSchema>;
export type BatchUpdate = z.infer<typeof batchUpdateSchema>;
export type Acknowledgment = z.infer<typeof acknowledgmentSchema>;
export type InsertAcknowledgment = z.infer<typeof insertAcknowledgmentSchema>;
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
export type ShipmentFilters = z.infer<typeof shipmentFiltersSchema>;

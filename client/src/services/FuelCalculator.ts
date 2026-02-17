import { 
  VehicleType, 
  FuelAnalytics,
  FuelType,
  City,
  FuelPrice,
  FuelConsumptionResult,
  FuelOptimizationSuggestion,
  FleetReport,
  MonthlyFleetReport
} from '@shared/types';

export {
  VehicleType, 
  FuelAnalytics,
  FuelType,
  City,
  FuelPrice,
  FuelConsumptionResult,
  FuelOptimizationSuggestion,
  FleetReport,
  MonthlyFleetReport
};

/* ============================================================
   Analytics helpers (runtime-safe, TS-friendly)
============================================================ */

type Numeric = number;

export function isValidFuelAnalytics(
  analytics: FuelAnalytics
): analytics is FuelAnalytics & {
  totalDistance: Numeric;
  totalFuelConsumed: Numeric;
  totalFuelCost: Numeric;
  averageEfficiency: Numeric;
  totalCO2Emissions: Numeric;
  costPerKm: Numeric;
  fuelPerKm: Numeric;
} {
  return (
    typeof analytics.totalDistance === 'number' &&
    typeof analytics.totalFuelConsumed === 'number' &&
    typeof analytics.totalFuelCost === 'number' &&
    typeof analytics.averageEfficiency === 'number' &&
    typeof analytics.totalCO2Emissions === 'number' &&
    typeof analytics.costPerKm === 'number' &&
    typeof analytics.fuelPerKm === 'number'
  );
}

export const AnalyticsMath = {
  divide(a: number, b: number, fallback = 0): number {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
    return a / b;
  },

  multiply(a: number, b: number, fallback = 0): number {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return fallback;
    return a * b;
  },

  round(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
};

// ============================================================
// INR Formatting helper for UI display
// ============================================================
export const formatINR = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value);

/* ============================================================
   Types
============================================================ */

export interface FuelCalculatorVehicleType
  extends Omit<VehicleType, 'fuel_efficiency' | 'fuel_type' | 'co2_emissions'> {
  fuelEfficiency: number;
  fuelType: FuelType;
  tankCapacity?: number;
  co2Emissions?: number;
}

// ============================================================
// Fleet Reports (including monthly aggregation)
// ============================================================

/* ============================================================
   FuelCalculator
============================================================ */
export class FuelCalculator {
  private vehicleTypes: Map<string, VehicleType> = new Map();
  private fuelPrices: Map<string, FuelPrice> = new Map();
  private evChargingLossFactor = 1.1; // 10% charging loss for EVs

  constructor() {
    this.initializeDefaultVehicleTypes();
    this.initializeDefaultFuelPrices();
  }

  /* -----------------------------
     Vehicle Type Management
  ----------------------------- */
  addVehicleType(vehicleType: VehicleType): void {
    this.vehicleTypes.set(vehicleType.id, vehicleType);
  }

  getVehicleTypes(): VehicleType[] {
    return Array.from(this.vehicleTypes.values());
  }

  getVehicleType(id: string): VehicleType | undefined {
    return this.vehicleTypes.get(id);
  }

  /* -----------------------------
     Fuel Price Management
  ----------------------------- */
  updateFuelPrice(fuelPrice: FuelPrice): void {
    this.fuelPrices.set(this.getFuelKey(fuelPrice.fuelType, fuelPrice.city), fuelPrice);
  }

  getFuelPrice(fuelType: FuelType, city: City): FuelPrice | undefined {
    return this.fuelPrices.get(this.getFuelKey(fuelType, city));
  }

  /* -----------------------------
     Fuel Consumption Calculator
  ----------------------------- */
  calculateFuelConsumption(
    distance: number,
    vehicleTypeId: string,
    city: City,
    conditions?: {
      trafficFactor?: number;
      weatherFactor?: number;
      loadFactor?: number;
      drivingStyle?: 'eco' | 'normal' | 'aggressive';
    }
  ): FuelConsumptionResult {
    const vehicleType = this.vehicleTypes.get(vehicleTypeId);
    if (!vehicleType) throw new Error(`Vehicle type ${vehicleTypeId} not found`);

    const fuelType = vehicleType.fuel_type as FuelType; // TS-safe

    const fuelPrice = this.fuelPrices.get(this.getFuelKey(fuelType, city));
    if (!fuelPrice) throw new Error(`Fuel price for ${fuelType} in ${city} not found`);

    let fuelConsumed = distance / vehicleType.fuel_efficiency;

    if (fuelType === 'electric') fuelConsumed *= this.evChargingLossFactor;

    if (conditions) {
      const trafficFactor = conditions.trafficFactor ?? 1.0;
      const weatherFactor = conditions.weatherFactor ?? 1.0;
      const loadFactor = conditions.loadFactor ?? 1.0;

      let drivingStyleFactor = 1.0;
      if (conditions.drivingStyle === 'eco') drivingStyleFactor = 0.9;
      if (conditions.drivingStyle === 'aggressive') drivingStyleFactor = 1.2;

      fuelConsumed *= trafficFactor * weatherFactor * loadFactor * drivingStyleFactor;
    }

    const baseCost = fuelConsumed * fuelPrice.pricePerUnit;
    const gstAmount = baseCost * (fuelPrice.gstPercent / 100);
    const totalCost = baseCost + gstAmount;

    const actualEfficiency = distance / fuelConsumed;
    const co2Emissions = vehicleType.co2_emissions ? vehicleType.co2_emissions * distance : undefined;

    return {
      distance,
      fuelConsumed: AnalyticsMath.round(fuelConsumed),
      fuelCost: AnalyticsMath.round(totalCost),
      formattedCost: formatINR(totalCost),
      efficiency: AnalyticsMath.round(actualEfficiency),
      co2Emissions: co2Emissions ? Math.round(co2Emissions) : undefined
    };
  }

  /* -----------------------------
     Fleet Report Generator
  ----------------------------- */
  generateFleetReport(
    records: {
      distance: number;
      vehicleTypeId: string;
      city: City;
      conditions?: {
        trafficFactor?: number;
        weatherFactor?: number;
        loadFactor?: number;
        drivingStyle?: 'eco' | 'normal' | 'aggressive';
      };
    }[]
  ): FleetReport[] {
    const report: FleetReport[] = [];

    for (const r of records) {
      const result = this.calculateFuelConsumption(
        r.distance,
        r.vehicleTypeId,
        r.city,
        r.conditions
      );

      const costPerKm = AnalyticsMath.divide(result.fuelCost, result.distance);
      const fuelPerKm = AnalyticsMath.divide(result.fuelConsumed, result.distance);

      report.push({
        city: r.city,
        vehicleId: r.vehicleTypeId,
        totalDistance: result.distance,
        totalFuelConsumed: result.fuelConsumed,
        totalFuelCost: result.fuelCost,
        totalCO2Emissions: result.co2Emissions,
        averageEfficiency: result.efficiency,
        costPerKm: AnalyticsMath.round(costPerKm, 3),
        fuelPerKm: AnalyticsMath.round(fuelPerKm, 3),
        formattedTotalCost: result.formattedCost
      });
    }

    return report;
  }

  /* -----------------------------
     Monthly Fleet Report Generator
  ----------------------------- */
  generateMonthlyFleetReport(
    records: {
      date: string;
      distance: number;
      vehicleTypeId: string;
      city: City;
      conditions?: {
        trafficFactor?: number;
        weatherFactor?: number;
        loadFactor?: number;
        drivingStyle?: 'eco' | 'normal' | 'aggressive';
      };
    }[]
  ): MonthlyFleetReport[] {
    const monthlyMap: Map<string, MonthlyFleetReport> = new Map();

    for (const r of records) {
      const result = this.calculateFuelConsumption(
        r.distance,
        r.vehicleTypeId,
        r.city,
        r.conditions
      );

      const dateObj = new Date(r.date);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();

      const key = `${r.vehicleTypeId}-${r.city}-${year}-${month}`;

      const existing = monthlyMap.get(key);
      if (existing) {
        existing.total_distance += result.distance;
        existing.total_fuel_consumed += result.fuel_consumed;
        existing.total_fuel_cost += result.fuel_cost;
        if (result.co2_emissions !== undefined) {
          existing.total_co2_emissions = (existing.total_co2_emissions || 0) + result.co2_emissions;
        }
        existing.average_efficiency = AnalyticsMath.round(existing.total_distance / existing.total_fuel_consumed);
        existing.cost_per_km = AnalyticsMath.round(existing.total_fuel_cost / existing.total_distance, 3);
        existing.fuel_per_km = AnalyticsMath.round(existing.total_fuel_consumed / existing.total_distance, 3);
        existing.formatted_total_cost = formatINR(existing.total_fuel_cost);
      } else {
        monthlyMap.set(key, {
          city: r.city,
          vehicle_id: r.vehicleTypeId,
          total_distance: result.distance,
          total_fuel_consumed: result.fuel_consumed,
          total_fuel_cost: result.fuel_cost,
          total_co2_emissions: result.co2_emissions,
          average_efficiency: result.efficiency,
          cost_per_km: AnalyticsMath.round(result.fuel_cost / result.distance, 3),
          fuel_per_km: AnalyticsMath.round(result.fuel_consumed / result.distance, 3),
          formatted_total_cost: result.formatted_cost,
          month,
          year
        });
      }
    }

    return Array.from(monthlyMap.values());
  }

  /* -----------------------------
     Fuel Optimization Suggestions
  ----------------------------- */
  generateFuelOptimizationSuggestions(
    analytics: FuelAnalytics,
    benchmarks?: {
      targetEfficiency?: number;
      maxCostPerKm?: number;
      maxEmissionsPerKm?: number;
    }
  ): FuelOptimizationSuggestion[] {
    const suggestions: FuelOptimizationSuggestion[] = [];
    const targets = {
      targetEfficiency: 15,
      maxCostPerKm: 0.12,
      maxEmissionsPerKm: 150,
      ...benchmarks
    };

    if (isValidFuelAnalytics(analytics) && analytics.averageEfficiency < targets.targetEfficiency) {
      const efficiencyGap = targets.targetEfficiency - analytics.averageEfficiency;
      const potentialFuelSaving = analytics.totalDistance * (AnalyticsMath.divide(1, analytics.averageEfficiency) - AnalyticsMath.divide(1, targets.targetEfficiency));
      const potentialCostSaving = AnalyticsMath.multiply(potentialFuelSaving, AnalyticsMath.divide(analytics.totalFuelCost, analytics.totalFuelConsumed));

      suggestions.push({
        type: 'efficiency',
        severity: efficiencyGap > 5 ? 'high' : efficiencyGap > 2 ? 'medium' : 'low',
        title: 'Fuel Efficiency Below Target',
        description: `Current efficiency is ${analytics.averageEfficiency.toFixed(1)} km/L, below target of ${targets.targetEfficiency} km/L.`,
        potentialSaving: {
          fuel: AnalyticsMath.round(potentialFuelSaving),
          cost: AnalyticsMath.round(potentialCostSaving)
        },
        recommendation: 'Consider driver training, vehicle maintenance, or fleet upgrades.'
      });
    }

    if (isValidFuelAnalytics(analytics) && analytics.costPerKm > targets.maxCostPerKm) {
      const excess = analytics.costPerKm - targets.maxCostPerKm;
      const potentialCostSaving = excess * analytics.totalDistance;

      suggestions.push({
        type: 'cost',
        severity: excess > targets.maxCostPerKm * 0.5 ? 'high' : excess > targets.maxCostPerKm * 0.2 ? 'medium' : 'low',
        title: 'High Fuel Cost Per Kilometer',
        description: `Current cost is ${analytics.costPerKm.toFixed(3)} per km, above target.`,
        potentialSaving: { cost: AnalyticsMath.round(potentialCostSaving) },
        recommendation: 'Review fuel contracts, routing, or vehicle allocation.'
      });
    }

    if (isValidFuelAnalytics(analytics) && targets.maxEmissionsPerKm) {
      const emissionsPerKm = AnalyticsMath.divide(analytics.totalCO2Emissions, analytics.totalDistance);
      if (emissionsPerKm > targets.maxEmissionsPerKm) {
        const excess = emissionsPerKm - targets.maxEmissionsPerKm;
        const potentialSaving = excess * analytics.totalDistance;
        suggestions.push({
          type: 'emissions',
          severity: excess > targets.maxEmissionsPerKm * 0.3 ? 'high' : excess > targets.maxEmissionsPerKm * 0.1 ? 'medium' : 'low',
          title: 'High CO2 Emissions',
          description: `Current emissions are ${emissionsPerKm.toFixed(0)} g/km, above target.`,
          potentialSaving: { co2: Math.round(potentialSaving) },
          recommendation: 'Adopt EVs/hybrids and reinforce eco-driving.'
        });
      }
    }

    return suggestions;
  }

  /* -----------------------------
     Default Vehicle Types
  ----------------------------- */
  private initializeDefaultVehicleTypes(): void {
    const now = new Date().toISOString();
    [
      { id: 'standard-van', name: 'Standard Delivery Van', fuel_efficiency: 12, fuel_type: 'diesel', co2_emissions: 180, icon: 'truck' },
      { id: 'compact-van', name: 'Compact Van', fuel_efficiency: 15, fuel_type: 'gasoline', co2_emissions: 150, icon: 'truck' },
      { id: 'electric-van', name: 'Electric Van', fuel_efficiency: 6, fuel_type: 'electric', co2_emissions: 0, icon: 'zap' }
    ].forEach(v => this.vehicleTypes.set(v.id, { ...v, created_at: now, updated_at: now }));
  }

  /* -----------------------------
     Default Fuel Prices
     - City-wise with GST
     - Electric handled separately with charging loss
  ----------------------------- */
  private initializeDefaultFuelPrices(): void {
    const prices = [
      { city: 'Delhi', fuelType: 'gasoline', pricePerUnit: 105, gstPercent: 0 },
      { city: 'Delhi', fuelType: 'diesel', pricePerUnit: 95, gstPercent: 0 },
      { city: 'Delhi', fuelType: 'electric', pricePerUnit: 8, gstPercent: 18 },

      { city: 'Bangalore', fuelType: 'gasoline', pricePerUnit: 101, gstPercent: 0 },
      { city: 'Bangalore', fuelType: 'diesel', pricePerUnit: 86, gstPercent: 0 },
      { city: 'Bangalore', fuelType: 'electric', pricePerUnit: 9, gstPercent: 18 },

      { city: 'Chennai', fuelType: 'gasoline', pricePerUnit: 102, gstPercent: 0 },
      { city: 'Chennai', fuelType: 'diesel', pricePerUnit: 94, gstPercent: 0 },
      { city: 'Chennai', fuelType: 'electric', pricePerUnit: 7.5, gstPercent: 18 }
    ] as const;

    prices.forEach(p => this.fuelPrices.set(this.getFuelKey(p.fuelType, p.city), {
      fuelType: p.fuelType,
      city: p.city,
      pricePerUnit: p.pricePerUnit,
      gstPercent: p.gstPercent,
      currency: 'INR',
      lastUpdated: new Date().toISOString()
    }));
  }

  // Helper for Map key
  private getFuelKey(fuelType: FuelType, city: City): string {
    return `${fuelType}-${city}`;
  }
}

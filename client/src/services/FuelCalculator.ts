export interface VehicleType {
  id: string;
  name: string;
  fuelEfficiency: number; // km per liter
  fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid';
  tankCapacity?: number; // liters
  co2Emissions?: number; // grams per km
}

export interface FuelPrice {
  fuelType: 'gasoline' | 'diesel' | 'electric';
  pricePerUnit: number; // per liter or per kWh for electric
  currency: string;
  lastUpdated: string;
}

export interface FuelConsumptionResult {
  distance: number; // km
  fuelConsumed: number; // liters or kWh
  fuelCost: number; // in currency
  co2Emissions?: number; // grams
  efficiency: number; // km per liter or km per kWh
}

export interface FuelAnalytics {
  totalDistance: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageEfficiency: number;
  totalCO2Emissions?: number;
  costPerKm: number;
  fuelPerKm: number;
  breakdown: {
    byVehicleType: Record<string, FuelConsumptionResult>;
    byTimeRange: Array<{
      period: string;
      consumption: FuelConsumptionResult;
    }>;
  };
}

export interface FuelOptimizationSuggestion {
  type: 'efficiency' | 'cost' | 'emissions';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potentialSaving: {
    fuel?: number; // liters
    cost?: number; // currency
    co2?: number; // grams
  };
  recommendation: string;
}

export class FuelCalculator {
  private vehicleTypes: Map<string, VehicleType> = new Map();
  private fuelPrices: Map<string, FuelPrice> = new Map();

  constructor() {
    this.initializeDefaultVehicleTypes();
    this.initializeDefaultFuelPrices();
  }

  /**
   * Add or update a vehicle type
   */
  addVehicleType(vehicleType: VehicleType): void {
    this.vehicleTypes.set(vehicleType.id, vehicleType);
  }

  /**
   * Get all vehicle types
   */
  getVehicleTypes(): VehicleType[] {
    return Array.from(this.vehicleTypes.values());
  }

  /**
   * Get a specific vehicle type
   */
  getVehicleType(id: string): VehicleType | undefined {
    return this.vehicleTypes.get(id);
  }

  /**
   * Update fuel price
   */
  updateFuelPrice(fuelPrice: FuelPrice): void {
    this.fuelPrices.set(fuelPrice.fuelType, fuelPrice);
  }

  /**
   * Get fuel price
   */
  getFuelPrice(fuelType: string): FuelPrice | undefined {
    return this.fuelPrices.get(fuelType);
  }

  /**
   * Calculate fuel consumption for a given distance and vehicle
   */
  calculateFuelConsumption(
    distance: number, // km
    vehicleTypeId: string,
    conditions?: {
      trafficFactor?: number; // 1.0 = normal, 1.2 = heavy traffic
      weatherFactor?: number; // 1.0 = normal, 1.1 = adverse weather
      loadFactor?: number; // 1.0 = normal load, 1.15 = heavy load
      drivingStyle?: 'eco' | 'normal' | 'aggressive'; // affects efficiency
    }
  ): FuelConsumptionResult {
    const vehicleType = this.vehicleTypes.get(vehicleTypeId);
    if (!vehicleType) {
      throw new Error(`Vehicle type ${vehicleTypeId} not found`);
    }

    const fuelPrice = this.fuelPrices.get(vehicleType.fuelType);
    if (!fuelPrice) {
      throw new Error(`Fuel price for ${vehicleType.fuelType} not found`);
    }

    // Calculate base fuel consumption
    let baseFuelConsumed = distance / vehicleType.fuelEfficiency;

    // Apply condition factors
    if (conditions) {
      const trafficFactor = conditions.trafficFactor || 1.0;
      const weatherFactor = conditions.weatherFactor || 1.0;
      const loadFactor = conditions.loadFactor || 1.0;

      let drivingStyleFactor = 1.0;
      switch (conditions.drivingStyle) {
        case 'eco':
          drivingStyleFactor = 0.9;
          break;
        case 'aggressive':
          drivingStyleFactor = 1.2;
          break;
        default:
          drivingStyleFactor = 1.0;
      }

      baseFuelConsumed *= trafficFactor * weatherFactor * loadFactor * drivingStyleFactor;
    }

    const fuelCost = baseFuelConsumed * fuelPrice.pricePerUnit;
    const actualEfficiency = distance / baseFuelConsumed;
    const co2Emissions = vehicleType.co2Emissions ? vehicleType.co2Emissions * distance : undefined;

    return {
      distance,
      fuelConsumed: Math.round(baseFuelConsumed * 100) / 100,
      fuelCost: Math.round(fuelCost * 100) / 100,
      co2Emissions: co2Emissions ? Math.round(co2Emissions) : undefined,
      efficiency: Math.round(actualEfficiency * 100) / 100
    };
  }

  /**
   * Calculate fuel consumption for multiple trips
   */
  calculateMultipleTripsFuel(
    trips: Array<{
      distance: number;
      vehicleTypeId: string;
      conditions?: any;
    }>
  ): FuelAnalytics {
    const results = trips.map(trip =>
      this.calculateFuelConsumption(trip.distance, trip.vehicleTypeId, trip.conditions)
    );

    const totalDistance = results.reduce((sum, result) => sum + result.distance, 0);
    const totalFuelConsumed = results.reduce((sum, result) => sum + result.fuelConsumed, 0);
    const totalFuelCost = results.reduce((sum, result) => sum + result.fuelCost, 0);
    const totalCO2Emissions = results.reduce((sum, result) => sum + (result.co2Emissions || 0), 0);

    const averageEfficiency = totalDistance > 0 ? totalDistance / totalFuelConsumed : 0;
    const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;
    const fuelPerKm = totalDistance > 0 ? totalFuelConsumed / totalDistance : 0;

    // Group by vehicle type
    const byVehicleType: Record<string, FuelConsumptionResult> = {};
    trips.forEach((trip, index) => {
      const result = results[index];
      if (!byVehicleType[trip.vehicleTypeId]) {
        byVehicleType[trip.vehicleTypeId] = {
          distance: 0,
          fuelConsumed: 0,
          fuelCost: 0,
          co2Emissions: 0,
          efficiency: 0
        };
      }

      const existing = byVehicleType[trip.vehicleTypeId];
      existing.distance += result.distance;
      existing.fuelConsumed += result.fuelConsumed;
      existing.fuelCost += result.fuelCost;
      existing.co2Emissions = (existing.co2Emissions || 0) + (result.co2Emissions || 0);
      existing.efficiency = existing.distance > 0 ? existing.distance / existing.fuelConsumed : 0;
    });

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      averageEfficiency: Math.round(averageEfficiency * 100) / 100,
      totalCO2Emissions: Math.round(totalCO2Emissions),
      costPerKm: Math.round(costPerKm * 100) / 100,
      fuelPerKm: Math.round(fuelPerKm * 100) / 100,
      breakdown: {
        byVehicleType,
        byTimeRange: [] // This would be populated with time-based analysis
      }
    };
  }

  /**
   * Generate fuel optimization suggestions
   */
  generateFuelOptimizationSuggestions(
    analytics: FuelAnalytics,
    benchmarks?: {
      targetEfficiency?: number; // km per liter
      maxCostPerKm?: number; // currency per km
      maxEmissionsPerKm?: number; // grams per km
    }
  ): FuelOptimizationSuggestion[] {
    const suggestions: FuelOptimizationSuggestion[] = [];
    const defaultBenchmarks = {
      targetEfficiency: 15.0, // km per liter
      maxCostPerKm: 0.12, // currency per km
      maxEmissionsPerKm: 150 // grams per km
    };

    const targets = { ...defaultBenchmarks, ...benchmarks };

    // Efficiency analysis
    if (analytics.averageEfficiency < targets.targetEfficiency) {
      const efficiencyGap = targets.targetEfficiency - analytics.averageEfficiency;
      const potentialFuelSaving = analytics.totalDistance * (1 / analytics.averageEfficiency - 1 / targets.targetEfficiency);
      const potentialCostSaving = potentialFuelSaving * (analytics.totalFuelCost / analytics.totalFuelConsumed);

      suggestions.push({
        type: 'efficiency',
        severity: efficiencyGap > 5 ? 'high' : efficiencyGap > 2 ? 'medium' : 'low',
        title: 'Fuel Efficiency Below Target',
        description: `Current efficiency is ${analytics.averageEfficiency.toFixed(1)} km/L, below target of ${targets.targetEfficiency} km/L.`,
        potentialSaving: {
          fuel: Math.round(potentialFuelSaving * 100) / 100,
          cost: Math.round(potentialCostSaving * 100) / 100
        },
        recommendation: 'Consider driver training for eco-driving techniques, vehicle maintenance, or upgrading to more fuel-efficient vehicles.'
      });
    }

    // Cost analysis
    if (analytics.costPerKm > targets.maxCostPerKm) {
      const costExcess = analytics.costPerKm - targets.maxCostPerKm;
      const potentialCostSaving = costExcess * analytics.totalDistance;

      suggestions.push({
        type: 'cost',
        severity: costExcess > targets.maxCostPerKm * 0.5 ? 'high' : costExcess > targets.maxCostPerKm * 0.2 ? 'medium' : 'low',
        title: 'High Fuel Cost Per Kilometer',
        description: `Current cost is ${analytics.costPerKm.toFixed(3)} per km, above target of ${targets.maxCostPerKm.toFixed(3)} per km.`,
        potentialSaving: {
          cost: Math.round(potentialCostSaving * 100) / 100
        },
        recommendation: 'Review fuel purchasing strategies, consider fuel cards with discounts, or optimize routes to reduce total distance.'
      });
    }

    // Emissions analysis
    if (analytics.totalCO2Emissions && targets.maxEmissionsPerKm) {
      const emissionsPerKm = analytics.totalCO2Emissions / analytics.totalDistance;
      if (emissionsPerKm > targets.maxEmissionsPerKm) {
        const emissionsExcess = emissionsPerKm - targets.maxEmissionsPerKm;
        const potentialEmissionsSaving = emissionsExcess * analytics.totalDistance;

        suggestions.push({
          type: 'emissions',
          severity: emissionsExcess > targets.maxEmissionsPerKm * 0.3 ? 'high' : emissionsExcess > targets.maxEmissionsPerKm * 0.1 ? 'medium' : 'low',
          title: 'High CO2 Emissions',
          description: `Current emissions are ${emissionsPerKm.toFixed(0)} g/km, above target of ${targets.maxEmissionsPerKm} g/km.`,
          potentialSaving: {
            co2: Math.round(potentialEmissionsSaving)
          },
          recommendation: 'Consider transitioning to hybrid or electric vehicles, optimize routes, and implement eco-driving practices.'
        });
      }
    }

    return suggestions;
  }

  /**
   * Compare fuel efficiency across different vehicle types
   */
  compareVehicleEfficiency(
    analytics: FuelAnalytics
  ): Array<{
    vehicleTypeId: string;
    vehicleType?: VehicleType;
    efficiency: number;
    costPerKm: number;
    emissionsPerKm?: number;
    ranking: number;
  }> {
    const comparisons = Object.entries(analytics.breakdown.byVehicleType).map(([vehicleTypeId, data]) => {
      const vehicleType = this.vehicleTypes.get(vehicleTypeId);
      const emissionsPerKm = data.co2Emissions && data.distance > 0 ? data.co2Emissions / data.distance : undefined;
      const costPerKm = data.distance > 0 ? data.fuelCost / data.distance : 0;

      return {
        vehicleTypeId,
        vehicleType,
        efficiency: data.efficiency,
        costPerKm,
        emissionsPerKm,
        ranking: 0 // Will be calculated below
      };
    });

    // Calculate rankings based on efficiency (higher is better)
    comparisons.sort((a, b) => b.efficiency - a.efficiency);
    comparisons.forEach((comp, index) => {
      comp.ranking = index + 1;
    });

    return comparisons;
  }

  /**
   * Calculate fuel budget for a planned route
   */
  calculateFuelBudget(
    plannedDistance: number,
    vehicleTypeId: string,
    safetyMargin: number = 0.1 // 10% safety margin
  ): {
    estimatedFuel: number;
    estimatedCost: number;
    recommendedBudget: number;
    fuelWithMargin: number;
  } {
    const consumption = this.calculateFuelConsumption(plannedDistance, vehicleTypeId);
    const fuelWithMargin = consumption.fuelConsumed * (1 + safetyMargin);
    const recommendedBudget = consumption.fuelCost * (1 + safetyMargin);

    return {
      estimatedFuel: consumption.fuelConsumed,
      estimatedCost: consumption.fuelCost,
      recommendedBudget: Math.round(recommendedBudget * 100) / 100,
      fuelWithMargin: Math.round(fuelWithMargin * 100) / 100
    };
  }

  private initializeDefaultVehicleTypes(): void {
    const defaultVehicles: VehicleType[] = [
      {
        id: 'standard-van',
        name: 'Standard Delivery Van',
        fuelEfficiency: 12.0,
        fuelType: 'diesel',
        tankCapacity: 70,
        co2Emissions: 180
      },
      {
        id: 'compact-van',
        name: 'Compact Van',
        fuelEfficiency: 15.0,
        fuelType: 'gasoline',
        tankCapacity: 50,
        co2Emissions: 150
      },
      {
        id: 'electric-van',
        name: 'Electric Van',
        fuelEfficiency: 25.0, // km per kWh equivalent
        fuelType: 'electric',
        tankCapacity: 60, // kWh
        co2Emissions: 0
      },
      {
        id: 'hybrid-van',
        name: 'Hybrid Van',
        fuelEfficiency: 18.0,
        fuelType: 'hybrid',
        tankCapacity: 55,
        co2Emissions: 120
      },
      {
        id: 'motorcycle',
        name: 'Delivery Motorcycle',
        fuelEfficiency: 35.0,
        fuelType: 'gasoline',
        tankCapacity: 15,
        co2Emissions: 80
      }
    ];

    defaultVehicles.forEach(vehicle => {
      this.vehicleTypes.set(vehicle.id, vehicle);
    });
  }

  private initializeDefaultFuelPrices(): void {
    const defaultPrices: FuelPrice[] = [
      {
        fuelType: 'gasoline',
        pricePerUnit: 1.45,
        currency: 'USD',
        lastUpdated: new Date().toISOString()
      },
      {
        fuelType: 'diesel',
        pricePerUnit: 1.35,
        currency: 'USD',
        lastUpdated: new Date().toISOString()
      },
      {
        fuelType: 'electric',
        pricePerUnit: 0.12, // per kWh
        currency: 'USD',
        lastUpdated: new Date().toISOString()
      }
    ];

    defaultPrices.forEach(price => {
      this.fuelPrices.set(price.fuelType, price);
    });
  }
}
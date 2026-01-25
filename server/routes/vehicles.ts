import type { Express } from "express";
import { storage } from "../storage.js";
import { InsertVehicleType, UpdateVehicleType } from "@shared/types";
import { log } from "../../shared/utils/logger.js";

export function registerVehicleRoutes(app: Express): void {
  // Vehicle Types CRUD endpoints
  app.get('/api/vehicle-types', async (req, res) => {
    try {
      const vehicleTypes = await storage.getVehicleTypes();
      res.json(vehicleTypes);
    } catch (error: unknown) {
      log.error('Error fetching vehicle types:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to fetch vehicle types' });
    }
  });

  app.get('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await storage.getVehicleType(id);
      if (!vehicleType) {
        return res.status(404).json({ error: 'Vehicle type not found' });
      }
      res.json(vehicleType);
    } catch (error: unknown) {
      log.error('Error fetching vehicle type:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to fetch vehicle type' });
    }
  });

  app.post('/api/vehicle-types', async (req, res) => {
    try {
      const vehicleTypeData: InsertVehicleType = req.body;
      const newVehicleType = await storage.createVehicleType(vehicleTypeData);
      log.info('Vehicle type created:', newVehicleType);
      res.status(201).json(newVehicleType);
    } catch (error: unknown) {
      log.error('Error creating vehicle type:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to create vehicle type' });
    }
  });

  app.put('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData: UpdateVehicleType = req.body;
      const updatedVehicleType = await storage.updateVehicleType(id, updateData);
      log.info('Vehicle type updated:', updatedVehicleType);
      res.json(updatedVehicleType);
    } catch (error: unknown) {
      log.error('Error updating vehicle type:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to update vehicle type' });
    }
  });

  app.delete('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVehicleType(id);
      log.info('Vehicle type deleted:', { id });
      res.status(204).send();
    } catch (error: unknown) {
      log.error('Error deleting vehicle type:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to delete vehicle type' });
    }
  });

  // Fuel Settings CRUD endpoints
  app.get('/api/fuel-settings', async (req, res) => {
    try {
      const fuelSettings = await storage.getFuelSettings();
      res.json(fuelSettings);
    } catch (error: unknown) {
      log.error('Error fetching fuel settings:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to fetch fuel settings' });
    }
  });

  app.get('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const fuelSetting = await storage.getFuelSetting(id);
      if (!fuelSetting) {
        return res.status(404).json({ error: 'Fuel setting not found' });
      }
      res.json(fuelSetting);
    } catch (error: unknown) {
      log.error('Error fetching fuel setting:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to fetch fuel setting' });
    }
  });

  app.post('/api/fuel-settings', async (req, res) => {
    try {
      const fuelSettingData = req.body;
      const newFuelSetting = await storage.createFuelSetting(fuelSettingData);
      log.info('Fuel setting created:', newFuelSetting);
      res.status(201).json(newFuelSetting);
    } catch (error: unknown) {
      log.error('Error creating fuel setting:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to create fuel setting' });
    }
  });

  app.put('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedFuelSetting = await storage.updateFuelSetting(id, updateData);
      log.info('Fuel setting updated:', updatedFuelSetting);
      res.json(updatedFuelSetting);
    } catch (error: unknown) {
      log.error('Error updating fuel setting:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to update fuel setting' });
    }
  });

  app.delete('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFuelSetting(id);
      log.info('Fuel setting deleted:', { id });
      res.status(204).send();
    } catch (error: unknown) {
      log.error('Error deleting fuel setting:', (error instanceof Error ? error.message : String(error)));
      res.status(500).json({ error: 'Failed to delete fuel setting' });
    }
  });
}
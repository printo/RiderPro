#!/usr/bin/env node

/**
 * Fix database schema issues
 * Run with: node fix-database.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'server/db');
const liveDbPath = path.join(dbDir, 'sqlite.db');
const replicaDbPath = path.join(dbDir, 'replica_sqlite.db');

function fixDatabase(dbPath, dbName) {
  console.log(`\n🔧 Fixing ${dbName} database...`);
  
  if (!fs.existsSync(dbPath)) {
    console.log(`⚠️  Database not found: ${dbPath}`);
    return false;
  }

  try {
    const db = new Database(dbPath);
    
    // Check current table structure
    const tableInfo = db.prepare("PRAGMA table_info(shipments)").all();
    console.log(`📋 Current columns: ${tableInfo.map(col => col.name).join(', ')}`);
    
    const hasLatitude = tableInfo.some(col => col.name === 'latitude');
    const hasLongitude = tableInfo.some(col => col.name === 'longitude');
    
    console.log(`📍 Location columns: latitude=${hasLatitude}, longitude=${hasLongitude}`);
    
    // Add missing columns
    if (!hasLatitude) {
      console.log('   Adding latitude column...');
      db.exec('ALTER TABLE shipments ADD COLUMN latitude REAL');
    }
    
    if (!hasLongitude) {
      console.log('   Adding longitude column...');
      db.exec('ALTER TABLE shipments ADD COLUMN longitude REAL');
    }
    
    // Create location index
    console.log('   Creating/updating location index...');
    db.exec('CREATE INDEX IF NOT EXISTS idx_shipments_location ON shipments(latitude, longitude)');
    
    // Verify final structure
    const finalTableInfo = db.prepare("PRAGMA table_info(shipments)").all();
    const finalHasLatitude = finalTableInfo.some(col => col.name === 'latitude');
    const finalHasLongitude = finalTableInfo.some(col => col.name === 'longitude');
    
    if (finalHasLatitude && finalHasLongitude) {
      console.log(`✅ ${dbName} database fixed successfully`);
      
      // Show indexes
      const indexes = db.prepare("PRAGMA index_list(shipments)").all();
      console.log(`📊 Indexes: ${indexes.map(idx => idx.name).join(', ')}`);
      
    } else {
      console.log(`❌ ${dbName} database fix failed`);
      db.close();
      return false;
    }
    
    db.close();
    return true;
    
  } catch (error) {
    console.error(`❌ Error fixing ${dbName}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Database Schema Fix Tool');
  console.log('============================');
  console.log('This will add latitude and longitude columns to existing databases.');
  
  let success = true;
  
  // Fix live database
  if (!fixDatabase(liveDbPath, 'Live')) {
    success = false;
  }
  
  // Fix replica database
  if (!fixDatabase(replicaDbPath, 'Replica')) {
    success = false;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (success) {
    console.log('🎉 Database fix completed successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Added latitude REAL column (if missing)');
    console.log('   • Added longitude REAL column (if missing)');
    console.log('   • Created location index for performance');
    console.log('\n🚀 You can now start the server:');
    console.log('   npm run dev');
  } else {
    console.log('❌ Database fix failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the fix
main();
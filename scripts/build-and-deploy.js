#!/usr/bin/env node

/**
 * Build and Deploy Script
 * 
 * This script handles the complete build and deployment process:
 * 1. Database initialization and indexing
 * 2. Frontend build
 * 3. Backend build
 * 4. Production deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n🔧 ${description}...`, 'blue');
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function main() {
  log('🚀 Starting RiderPro Build and Deploy Process', 'blue');
  
  // Step 1: Database initialization and indexing
  log('\n📊 Step 1: Database Initialization and Indexing', 'yellow');
  runCommand('INITIALIZE_DB=true npm run db:migrate', 'Database migration and indexing');
  
  // Step 2: Type checking
  log('\n🔍 Step 2: Type Checking', 'yellow');
  runCommand('npm run check', 'TypeScript type checking');
  
  // Step 3: Frontend build
  log('\n🎨 Step 3: Frontend Build', 'yellow');
  runCommand('npm run build:client', 'Frontend build');
  
  // Step 4: Backend build
  log('\n⚙️ Step 4: Backend Build', 'yellow');
  runCommand('npm run build:server', 'Backend build');
  
  // Step 5: Production readiness check
  log('\n🔍 Step 5: Production Readiness Check', 'yellow');
  
  // Check if dist folder exists
  if (!fs.existsSync('dist')) {
    log('❌ Build output not found. Build process may have failed.', 'red');
    process.exit(1);
  }
  
  // Check if database files exist
  if (!fs.existsSync('data/riderpro.db')) {
    log('❌ Database not found. Database initialization may have failed.', 'red');
    process.exit(1);
  }
  
  log('✅ Production build completed successfully!', 'green');
  log('\n📋 Build Summary:', 'blue');
  log('  • Database: Initialized and indexed', 'green');
  log('  • Frontend: Built and optimized', 'green');
  log('  • Backend: Compiled and bundled', 'green');
  log('  • TypeScript: All types checked', 'green');
  
  log('\n🚀 Ready for deployment!', 'green');
  log('Run "npm start" to start the production server.', 'blue');
}

main().catch(error => {
  log(`❌ Build process failed: ${error.message}`, 'red');
  process.exit(1);
});

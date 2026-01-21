#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to replace console.log with appropriate log levels
const replacements = [
  {
    pattern: /console\.log\('User not found for riderId:', riderId\);/g,
    replacement: "log.warn('User not found for riderId:', riderId);"
  },
  {
    pattern: /console\.log\('Invalid password for riderId:', riderId\);/g,
    replacement: "log.warn('Invalid password for riderId:', riderId);"
  },
  {
    pattern: /console\.log\(`Syncing shipment \${syncData\.shipment_id\} \(\${validation\.size\} bytes\)`\);/g,
    replacement: "log.info(`Syncing shipment ${syncData.shipment_id} (${validation.size} bytes)`);"
  },
  {
    pattern: /console\.log\(`Batch syncing \${shipments\.length\} shipments\.\.\.\`\);/g,
    replacement: "log.info(`Batch syncing ${shipments.length} shipments...`);"
  },
  {
    pattern: /console\.log\(`Remarks for shipment \${shipmentId\} \(\${status\}\):`, remarks\);/g,
    replacement: "log.debug(`Remarks for shipment ${shipmentId} (${status}):`, remarks);"
  },
  {
    pattern: /console\.log\('Route session started:', session\);/g,
    replacement: "log.info('Route session started:', session);"
  },
  {
    pattern: /console\.log\('Route session stopped:', session\);/g,
    replacement: "log.info('Route session stopped:', session);"
  },
  {
    pattern: /console\.log\('GPS coordinate recorded:', coordinate\);/g,
    replacement: "log.debug('GPS coordinate recorded:', coordinate);"
  },
  {
    pattern: /console\.log\('Route shipment event recorded:', record\);/g,
    replacement: "log.info('Route shipment event recorded:', record);"
  },
  {
    pattern: /console\.log\('Batch GPS coordinate recorded:', coordinate\);/g,
    replacement: "log.debug('Batch GPS coordinate recorded:', coordinate);"
  },
  {
    pattern: /console\.log\('Offline session synced:', synced\);/g,
    replacement: "log.info('Offline session synced:', synced);"
  },
  {
    pattern: /console\.log\(`Offline coordinates synced for session \${sessionId\}:`, results\.length\);/g,
    replacement: "log.info(`Offline coordinates synced for session ${sessionId}:`, results.length);"
  },
  // Generic console.log replacements
  {
    pattern: /console\.log\(/g,
    replacement: "log.dev("
  }
];

function replaceInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Add import if file contains console.log and doesn't have logger import
    if (content.includes('console.log') && !content.includes('from "../../shared/utils/logger.js"') && !content.includes('from "../shared/utils/logger.js"')) {
      // Determine the correct import path based on file location
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..'));
      const importPath = filePath.includes('server/') ?
        '../../shared/utils/logger.js' :
        '../shared/utils/logger.js';

      // Add import after existing imports
      const importRegex = /(import.*from.*['"];?\n)/g;
      const imports = content.match(importRegex);
      if (imports) {
        const lastImport = imports[imports.length - 1];
        const importIndex = content.lastIndexOf(lastImport) + lastImport.length;
        content = content.slice(0, importIndex) +
          `import { log } from "${importPath}";\n` +
          content.slice(importIndex);
        modified = true;
      }
    }

    // Apply replacements
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      processDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      replaceInFile(filePath);
    }
  }
}

// Process server and client directories
const rootDir = path.join(__dirname, '..');
processDirectory(path.join(rootDir, 'server'));
processDirectory(path.join(rootDir, 'client'));

console.log('Console.log replacement completed!');
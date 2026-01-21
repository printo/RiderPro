#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixImportPath(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix client-side imports
    if (filePath.includes('client/src/')) {
      content = content.replace(
        /import { log } from "\.\.\/shared\/utils\/logger\.js";/g,
        'import { log } from "../../shared/utils/logger.js";'
      );
      modified = true;
    }

    // Fix server-side imports that are incorrect
    if (filePath.includes('server/vite.ts')) {
      content = content.replace(
        /import { log } from "\.\.\/\.\.\/shared\/utils\/logger\.js";/g,
        'import { log } from "../shared/utils/logger.js";'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed imports in: ${filePath}`);
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
      fixImportPath(filePath);
    }
  }
}

// Process client and server directories
const rootDir = path.join(__dirname, '..');
processDirectory(path.join(rootDir, 'client'));
processDirectory(path.join(rootDir, 'server'));

console.log('Import path fixes completed!');
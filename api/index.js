const express = require('express');
const path = require('path');

// Import your Express app from the built server
const app = require('../dist/index.js');

// Export the Express app for Vercel
module.exports = app;

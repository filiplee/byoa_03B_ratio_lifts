#!/usr/bin/env node
/**
 * CLI: Generate HTML from template + JSON.
 * Usage: node generate-html.mjs [data.json] [output.html]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderReport } from './report-render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataPath = process.argv[2] || join(__dirname, 'example-report.json');
const outputPath = process.argv[3] || join(__dirname, 'report-output.html');

const template = readFileSync(join(__dirname, 'report-template.html'), 'utf-8');
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

const html = renderReport(template, data);
writeFileSync(outputPath, html, 'utf-8');
console.log(`Wrote ${outputPath}`);

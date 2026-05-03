#!/usr/bin/env node
/**
 * Compare two LoRA files (solo-trained vs FFE joint-trained).
 * Shows metadata, training parameters, and differences.
 * 
 * Usage:
 *   node compare-loras.js <soloLoraPath> <ffeLoraPath>
 * 
 * Example:
 *   node compare-loras.js ./solo-lora.bin ./ffe-lora.bin
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function parseLoraFile(filePath) {
  const absolutePath = resolve(filePath);
  const data = readFileSync(absolutePath);
  
  // Try to parse as JSON (for simulation mode or JSON metadata)
  try {
    const text = data.toString('utf-8');
    const json = JSON.parse(text);
    return {
      format: 'json',
      data: json,
      size: data.length,
    };
  } catch (e) {
    // Could be binary format
    return {
      format: 'binary',
      data: data,
      size: data.length,
    };
  }
}

function formatValue(val) {
  if (typeof val === 'string' && val.length > 60) {
    return val.substring(0, 60) + '...';
  }
  if (typeof val === 'object') {
    return JSON.stringify(val).substring(0, 60) + '...';
  }
  return val;
}

function compareMetadata(solo, ffe) {
  if (solo.format !== 'json' || ffe.format !== 'json') {
    console.log('⚠️  Cannot compare metadata — one or both files are in binary format');
    console.log('');
    console.log('File sizes:');
    console.log(`  - Solo: ${solo.size} bytes`);
    console.log(`  - FFE:  ${ffe.size} bytes`);
    return;
  }

  const soloData = solo.data;
  const ffeData = ffe.data;

  console.log('📊 LoRA Training Metadata Comparison');
  console.log('');

  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(soloData || {}),
    ...Object.keys(ffeData || {}),
  ]);

  const relevantKeys = [
    'base_model',
    'rank',
    'lora_alpha',
    'learning_rate',
    'epochs',
    'training_samples',
    'batch_size',
    'data_fingerprint',
    'adapter_fingerprint',
    'tee_attestation',
    'mode',
  ];

  console.log('Key Differences:');
  console.log('');
  console.log(
    '│ Parameter           │ Solo-Trained      │ FFE Joint-Trained │'.padEnd(75)
  );
  console.log('├─────────────────────┼───────────────────┼───────────────────┤');

  let hasDifferences = false;
  for (const key of relevantKeys) {
    if (allKeys.has(key)) {
      const soloVal = soloData[key];
      const ffeVal = ffeData[key];
      const isDiff = JSON.stringify(soloVal) !== JSON.stringify(ffeVal);

      if (isDiff) {
        hasDifferences = true;
        const solo_str = String(formatValue(soloVal) || '(not set)');
        const ffe_str = String(formatValue(ffeVal) || '(not set)');
        
        const line = `│ ${key.padEnd(19)} │ ${solo_str.padEnd(17)} │ ${ffe_str.padEnd(17)} │`;
        console.log(line.substring(0, 80));
      }
    }
  }
  console.log('└─────────────────────┴───────────────────┴───────────────────┘');

  if (!hasDifferences) {
    console.log('✓ No differences in key parameters');
  }

  console.log('');
  console.log('📈 Training Metrics:');
  console.log('');

  // Compare specific metrics
  const metrics = [
    {
      label: 'Training Samples',
      key: 'training_samples',
      format: (v) => `${v} samples`,
    },
    {
      label: 'Epochs',
      key: 'epochs',
      format: (v) => `${v}`,
    },
    {
      label: 'LoRA Rank',
      key: 'rank',
      format: (v) => `${v}`,
    },
    {
      label: 'LoRA Alpha',
      key: 'lora_alpha',
      format: (v) => `${v}`,
    },
    {
      label: 'Learning Rate',
      key: 'learning_rate',
      format: (v) => `${v}`,
    },
    {
      label: 'Batch Size',
      key: 'batch_size',
      format: (v) => `${v}`,
    },
  ];

  metrics.forEach(({ label, key, format: fmt }) => {
    const soloVal = soloData[key];
    const ffeVal = ffeData[key];

    if (soloVal !== undefined || ffeVal !== undefined) {
      const solo_str = soloVal !== undefined ? fmt(soloVal) : '(not set)';
      const ffe_str = ffeVal !== undefined ? fmt(ffeVal) : '(not set)';

      // Highlight improvements
      if (key === 'training_samples' && ffeVal > soloVal) {
        console.log(`  ✓ ${label}: ${solo_str} → ${ffe_str} (${((ffeVal / soloVal - 1) * 100).toFixed(0)}% more data)`);
      } else if (solo_str !== ffe_str) {
        console.log(`  • ${label}: ${solo_str} (solo) vs ${ffe_str} (FFE)`);
      } else {
        console.log(`  • ${label}: ${solo_str}`);
      }
    }
  });

  console.log('');
  console.log('🔐 Data Fingerprints:');
  console.log('');
  console.log(`  Solo LoRA data hash:  ${soloData.data_fingerprint || '(not available)'}`);
  console.log(`  FFE LoRA data hash:   ${ffeData.data_fingerprint || '(not available)'}`);
  if (soloData.data_fingerprint !== ffeData.data_fingerprint) {
    console.log('  → Different data used for training (expected!)');
  }

  console.log('');
  console.log('File Sizes:');
  console.log(`  - Solo: ${solo.size} bytes`);
  console.log(`  - FFE:  ${ffe.size} bytes`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node compare-loras.js <soloLoraPath> <ffeLoraPath>');
    console.error('');
    console.error('Example:');
    console.error('  node compare-loras.js ./solo-lora.bin ./ffe-lora.bin');
    process.exit(1);
  }

  const soloPath = args[0];
  const ffePath = args[1];

  try {
    console.log('Loading LoRA files...');
    console.log('');

    const solo = parseLoraFile(soloPath);
    const ffe = parseLoraFile(ffePath);

    console.log(`Solo LoRA (${resolve(soloPath)})`);
    console.log(`  Format: ${solo.format}`);
    console.log(`  Size: ${solo.size} bytes`);
    console.log('');

    console.log(`FFE LoRA (${resolve(ffePath)})`);
    console.log(`  Format: ${ffe.format}`);
    console.log(`  Size: ${ffe.size} bytes`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    compareMetadata(solo, ffe);

    console.log('');
    console.log('💡 Next Steps:');
    console.log('');
    console.log('  1. Load both LoRA adapters into your base model');
    console.log('  2. Evaluate on a test dataset to compare:');
    console.log('     - Perplexity / Loss');
    console.log('     - Accuracy on target task');
    console.log('     - Inference speed');
    console.log('');
    console.log('  3. Compare data quality:');
    console.log('     - Check if FFE data fingerprint differs (means more data)');
    console.log('     - Measure quality gain from additional training data');
    console.log('');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

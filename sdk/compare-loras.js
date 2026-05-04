#!/usr/bin/env node
/**
 * Compare two LoRA files (solo-trained vs FFE joint-trained).
 * Shows metadata, training parameters, and differences.
 *
 * Supports: ZIP (HuggingFace), SafeTensors, JSON formats
 *
 * Usage:
 *   node compare-loras.js <soloLoraPath> <ffeLoraPath>
 *
 * Example:
 *   node compare-loras.js ./solo-lora.bin ./ffe-lora.bin
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

function detectFormat(filePath) {
  const data = readFileSync(filePath);

  // ZIP (PyTorch checkpoint or HuggingFace adapter)
  if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
    return 'zip';
  }

  // SafeTensors
  if (data.length > 8) {
    try {
      const headerLen = data.readBigUInt64LE(0);
      if (headerLen > 0n && headerLen < BigInt(data.length)) {
        const header = data.toString('utf-8', 8, Number(8n + headerLen));
        JSON.parse(header);
        return 'safetensors';
      }
    } catch {
      // Not SafeTensors
    }
  }

  // JSON
  try {
    const text = data.toString('utf-8');
    JSON.parse(text);
    return 'json';
  } catch {
    // Not JSON
  }

  return 'unknown';
}

function extractZip(filePath, destDir) {
  execSync(`unzip -o "${filePath}" -d "${destDir}"`, { stdio: 'pipe' });
}

function readJsonFromZip(filePath, internalPath) {
  const tmpDir = resolve(tmpdir(), `lora-compare-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  try {
    extractZip(filePath, tmpDir);
    const fullPath = resolve(tmpDir, internalPath);
    if (existsSync(fullPath)) {
      return JSON.parse(readFileSync(fullPath, 'utf-8'));
    }
    return null;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function parseZipLoraFile(filePath, label) {
  const data = readFileSync(filePath);
  const hash = createHash('md5').update(data).digest('hex');

  // Extract training info from trainer_state.json
  const trainerState =
    readJsonFromZip(filePath, 'output_model/checkpoint-200/trainer_state.json') ||
    readJsonFromZip(filePath, 'output_model/checkpoint-100/trainer_state.json') ||
    readJsonFromZip(filePath, 'output_model/trainer_state.json');

  const adapterConfig =
    readJsonFromZip(filePath, 'output_model/adapter_config.json') ||
    readJsonFromZip(filePath, 'adapter_config.json');

  const info = {
    format: 'zip',
    size: data.length,
    hash,
    label,
  };

  if (trainerState) {
    info.global_step = trainerState.global_step;
    info.epoch = trainerState.epoch;
    info.num_train_epochs = trainerState.num_train_epochs;
    info.batch_size = trainerState.train_batch_size;
    info.max_steps = trainerState.max_steps;
    info.total_flos = trainerState.total_flos;
    info.log_history = trainerState.log_history || [];
  }

  if (adapterConfig) {
    info.base_model = adapterConfig.base_model_name_or_path;
    info.peft_type = adapterConfig.peft_type;
    info.lora_r = adapterConfig.r;
    info.lora_alpha = adapterConfig.lora_alpha;
    info.lora_dropout = adapterConfig.lora_dropout;
    info.target_modules = adapterConfig.target_modules;
  }

  // Compute dataset size from steps and epochs
  if (info.global_step && info.epoch) {
    info.steps_per_epoch = info.global_step / info.epoch;
    info.estimated_samples = Math.round(info.steps_per_epoch * (info.batch_size || 1));
  }

  return info;
}

function parseSafetensorsFile(filePath, label) {
  const data = readFileSync(filePath);
  const headerLen = Number(data.readBigUInt64LE(0));
  const header = JSON.parse(data.toString('utf-8', 8, 8 + headerLen));

  const tensorKeys = Object.keys(header).filter((k) => k !== '__metadata__');
  const metadata = header.__metadata__ || {};

  return {
    format: 'safetensors',
    label,
    size: data.length,
    hash: createHash('md5').update(data).digest('hex'),
    tensor_count: tensorKeys.length,
    metadata,
  };
}

function parseJsonFile(filePath, label) {
  const data = readFileSync(filePath);
  const json = JSON.parse(data.toString('utf-8'));

  return {
    format: 'json',
    label,
    size: data.length,
    hash: createHash('md5').update(data).digest('hex'),
    data: json,
  };
}

function parseLoraFile(filePath, label) {
  const format = detectFormat(filePath);

  switch (format) {
    case 'zip':
      return parseZipLoraFile(filePath, label);
    case 'safetensors':
      return parseSafetensorsFile(filePath, label);
    case 'json':
      return parseJsonFile(filePath, label);
    default:
      return {
        format: 'unknown',
        label,
        size: readFileSync(filePath).length,
        hash: createHash('md5').update(readFileSync(filePath)).digest('hex'),
      };
  }
}

function formatNumber(n) {
  if (n === undefined || n === null) return '(unknown)';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function compareTraining(info1, info2) {
  const col1 = 22;
  const col2 = 25;
  const col3 = 25;

  console.log('');
  console.log(pad('Parameter', col1) + pad(info1.label, col2) + pad(info2.label, col3));
  console.log('-'.repeat(col1 + col2 + col3));

  const fields = [
    { key: 'format', label: 'Format' },
    { key: 'size', label: 'File Size', format: (v) => formatNumber(v) + ' bytes' },
    { key: 'hash', label: 'MD5 Hash', truncate: 12 },
    { key: 'peft_type', label: 'PEFT Type' },
    { key: 'base_model', label: 'Base Model', truncate: 30 },
    { key: 'lora_r', label: 'LoRA Rank (r)' },
    { key: 'lora_alpha', label: 'LoRA Alpha' },
    { key: 'lora_dropout', label: 'LoRA Dropout' },
    { key: 'global_step', label: 'Global Step' },
    { key: 'epoch', label: 'Epoch' },
    { key: 'num_train_epochs', label: 'Total Epochs' },
    { key: 'max_steps', label: 'Max Steps' },
    { key: 'batch_size', label: 'Batch Size' },
    { key: 'steps_per_epoch', label: 'Steps per Epoch' },
    { key: 'estimated_samples', label: 'Est. Dataset Size' },
    { key: 'total_flos', label: 'Total FLOPs', format: (v) => formatNumber(v) },
  ];

  let hasDiff = false;

  fields.forEach(({ key, label: fieldLabel, format: fmt, truncate }) => {
    const v1 = info1[key];
    const v2 = info2[key];

    if (v1 === undefined && v2 === undefined) return;

    const formatVal = (v) => {
      if (v === undefined) return '(n/a)';
      if (fmt) return fmt(v);
      if (truncate && typeof v === 'string' && v.length > truncate) {
        return v.substring(0, truncate) + '...';
      }
      return String(v);
    };

    const s1 = formatVal(v1);
    const s2 = formatVal(v2);

    if (s1 !== s2) hasDiff = true;

    console.log(pad(fieldLabel, col1) + pad(s1, col2) + pad(s2, col3));
  });

  console.log('');

  // Dataset size comparison
  if (info1.estimated_samples !== undefined && info2.estimated_samples !== undefined) {
    const ratio = info1.estimated_samples / info2.estimated_samples;
    if (ratio > 1) {
      console.log(`📊 ${info1.label} has ~${ratio.toFixed(1)}x more training samples`);
    } else if (ratio < 1) {
      console.log(`📊 ${info2.label} has ~${(1 / ratio).toFixed(1)}x more training samples`);
    } else {
      console.log('📊 Both have the same estimated dataset size');
    }
  }

  // Training loss comparison
  if (info1.log_history && info2.log_history && info1.log_history.length > 0 && info2.log_history.length > 0) {
    console.log('');
    console.log('Training Loss Progression:');
    console.log('');
    console.log(
      pad('Step', 8) +
        pad(info1.label + ' Loss', col2 + 2) +
        pad(info2.label + ' Loss', col3 + 2)
    );
    console.log('-'.repeat(8 + col2 + 2 + col3 + 2));

    const maxLen = Math.max(info1.log_history.length, info2.log_history.length);
    for (let i = 0; i < maxLen; i++) {
      const log1 = info1.log_history[i];
      const log2 = info2.log_history[i];
      if (!log1 && !log2) continue;

      const step = log1?.step ?? log2?.step ?? '?';
      const loss1 = log1?.loss !== undefined ? log1.loss.toFixed(4) : '(n/a)';
      const loss2 = log2?.loss !== undefined ? log2.loss.toFixed(4) : '(n/a)';

      console.log(pad(step, 8) + pad(loss1, col2 + 2) + pad(loss2, col3 + 2));
    }
  }

  // Target modules
  if (info1.target_modules || info2.target_modules) {
    console.log('');
    console.log('Target Modules:');
    const modules1 = info1.target_modules?.join(', ') || '(n/a)';
    const modules2 = info2.target_modules?.join(', ') || '(n/a)';
    if (modules1 === modules2) {
      console.log(`  Both: ${modules1}`);
    } else {
      console.log(`  ${info1.label}: ${modules1}`);
      console.log(`  ${info2.label}: ${modules2}`);
    }
  }
}

function compareWeights(filePath1, filePath2, label1, label2) {
  const tmpDir = resolve(tmpdir(), `lora-compare-weights-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    extractZip(filePath1, resolve(tmpDir, label1));
    extractZip(filePath2, resolve(tmpDir, label2));

    const safetensors = ['output_model/adapter_model.safetensors', 'adapter_model.safetensors'];
    let file1 = null, file2 = null;

    for (const name of safetensors) {
      const p1 = resolve(tmpDir, label1, name);
      const p2 = resolve(tmpDir, label2, name);
      if (existsSync(p1) && existsSync(p2)) {
        file1 = p1;
        file2 = p2;
        break;
      }
    }

    if (!file1) {
      console.log('\n⚠️  Could not find adapter_model.safetensors in either file for weight comparison');
      return;
    }

    const data1 = readFileSync(file1);
    const data2 = readFileSync(file2);

    const headerLen1 = Number(data1.readBigUInt64LE(0));
    const headerLen2 = Number(data2.readBigUInt64LE(0));

    const header1 = JSON.parse(data1.toString('utf-8', 8, 8 + headerLen1));
    const header2 = JSON.parse(data2.toString('utf-8', 8, 8 + headerLen2));

    const tensors1 = Object.keys(header1).filter((k) => k !== '__metadata__');
    const tensors2 = Object.keys(header2).filter((k) => k !== '__metadata__');

    console.log('\n🔬 Weight Comparison:');
    console.log(`  ${label1}: ${tensors1.length} tensors, data hash: ${createHash('md5').update(data1).digest('hex').substring(0, 12)}...`);
    console.log(`  ${label2}: ${tensors2.length} tensors, data hash: ${createHash('md5').update(data2).digest('hex').substring(0, 12)}...`);

    if (data1.equals(data2)) {
      console.log('  ⚠️  Weights are IDENTICAL - same model');
    } else {
      console.log('  ✓ Weights are different (as expected for different training)');
    }

    const set1 = new Set(tensors1);
    const set2 = new Set(tensors2);
    const common = tensors1.filter((k) => set2.has(k));
    const only1 = tensors1.filter((k) => !set2.has(k));
    const only2 = tensors2.filter((k) => !set1.has(k));

    if (only1.length > 0 || only2.length > 0) {
      console.log(`  Only in ${label1}: ${only1.length} tensors`);
      console.log(`  Only in ${label2}: ${only2.length} tensors`);
    } else {
      console.log(`  Tensor keys: identical (${common.length})`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node compare-loras.js <loraPath1> <loraPath2> [label1] [label2]');
    console.error('');
    console.error('Example:');
    console.error('  node compare-loras.js ./solo-lora.bin ./ffe-lora.bin Solo FFE');
    process.exit(1);
  }

  const path1 = args[0];
  const path2 = args[1];
  const label1 = args[2] || resolve(path1).split('/').pop();
  const label2 = args[3] || resolve(path2).split('/').pop();

  try {
    console.log(`Loading ${label1}...`);
    const info1 = parseLoraFile(path1, label1);

    console.log(`Loading ${label2}...`);
    const info2 = parseLoraFile(path2, label2);

    console.log('');
    console.log('='.repeat(80));
    console.log('LoRA Comparison');
    console.log('='.repeat(80));

    compareTraining(info1, info2);
    compareWeights(path1, path2, label1, label2);

    console.log('');
    console.log('='.repeat(80));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

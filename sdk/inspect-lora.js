#!/usr/bin/env node
/**
 * Inspect the downloaded FFE LoRA file to see its format and structure.
 * 
 * Usage:
 *   node inspect-lora.js <loraFilePath>
 * 
 * Example:
 *   node inspect-lora.js ./ffe-lora.bin
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node inspect-lora.js <loraFilePath>');
    console.error('');
    console.error('Example:');
    console.error('  node inspect-lora.js ./ffe-lora.bin');
    process.exit(1);
  }

  const filePath = args[0];
  const absolutePath = resolve(filePath);

  try {
    const data = readFileSync(absolutePath);
    
    console.log(`[Inspect] File: ${absolutePath}`);
    console.log(`[Inspect] Size: ${data.length} bytes`);
    console.log('');
    
    // Try to detect format
    console.log('[Inspect] Format Detection:');
    
    // Check if it's UTF-8 readable (likely JSON)
    try {
      const text = data.toString('utf-8');
      if (text.startsWith('{') || text.startsWith('[')) {
        console.log('  ✓ Appears to be JSON format');
        console.log('');
        console.log('[Inspect] Content (first 2000 chars):');
        console.log('---');
        console.log(text.substring(0, 2000));
        console.log('---');
        
        // Try to parse it
        try {
          const json = JSON.parse(text);
          console.log('');
          console.log('[Inspect] Parsed JSON keys:');
          console.log(Object.keys(json).map(k => `  - ${k}`).join('\n'));
          
          if (json.metadata) {
            console.log('');
            console.log('[Inspect] Metadata:');
            console.log(JSON.stringify(json.metadata, null, 2));
          }
        } catch (e) {
          console.log('  (Could not parse as JSON)');
        }
        return;
      }
    } catch (e) {
      // Not UTF-8
    }
    
    // Check for SafeTensors magic (00 08 00 00 in little-endian)
    if (data.length > 8 && data[0] === 0x00 && data[1] === 0x08 && data[2] === 0x00 && data[3] === 0x00) {
      console.log('  ✓ Appears to be SafeTensors format (.safetensors)');
      console.log('');
      console.log('[Inspect] SafeTensors Magic: found');
      
      // Try to parse header
      const headerLen = data.readUInt32LE(0);
      if (headerLen > 0 && headerLen < data.length - 8) {
        try {
          const headerJson = data.toString('utf-8', 8, 8 + headerLen);
          const header = JSON.parse(headerJson);
          console.log('');
          console.log('[Inspect] Tensors in file:');
          Object.entries(header).forEach(([key, val]) => {
            if (key !== '__metadata__') {
              console.log(`  - ${key}: shape=${JSON.stringify(val.shape)}, dtype=${val.dtype}`);
            }
          });
        } catch (e) {
          // Could not parse header
        }
      }
      return;
    }
    
    // Check for PyTorch pickle format
    if (data.length > 4 && data[0] === 0x80 && data[1] === 0x03) {
      console.log('  ✓ Appears to be PyTorch pickle format (.pt or .pth)');
      return;
    }
    
    // Check for ZIP (could be PyTorch or SafeTensors)
    if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
      console.log('  ✓ Appears to be ZIP format (could be PyTorch model or HuggingFace format)');
      return;
    }
    
    // Unknown binary
    console.log('  ? Unknown binary format');
    console.log('');
    console.log('[Inspect] First 256 bytes (hex):');
    let hex = '';
    for (let i = 0; i < Math.min(256, data.length); i++) {
      hex += data[i].toString(16).padStart(2, '0');
      if ((i + 1) % 32 === 0) hex += '\n';
      else if ((i + 1) % 16 === 0) hex += ' | ';
      else hex += ' ';
    }
    console.log(hex);
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Inspect] Error:', err.message);
    process.exit(1);
  }
}

main();

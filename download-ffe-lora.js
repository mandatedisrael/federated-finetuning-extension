#!/usr/bin/env node
/**
 * Download and save FFE LoRA file to disk for comparison with solo-trained model.
 * 
 * Usage:
 *   node download-ffe-lora.js <sessionId> <privateKey> [outputPath]
 * 
 * Example:
 *   node download-ffe-lora.js 1 0xabc123... ./ffe-lora.bin
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { FFE } from '@notmartin/ffe';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node download-ffe-lora.js <sessionId> <privateKey> [outputPath]');
    console.error('');
    console.error('Example:');
    console.error('  node download-ffe-lora.js 1 0xabc123... ./ffe-lora.bin');
    process.exit(1);
  }

  const sessionId = BigInt(args[0]);
  const privateKey = args[1];
  const outputPath = args[2] || `ffe-lora-session-${sessionId}.bin`;

  try {
    console.log(`[FFE Download] Downloading LoRA for session ${sessionId}...`);
    
    const ffe = new FFE({
      privateKey,
    });

    const result = await ffe.download({
      sessionId,
      recipientPrivateKey: privateKey,
    });

    const absolutePath = resolve(outputPath);
    writeFileSync(absolutePath, Buffer.from(result.data));
    
    console.log(`[FFE Download] ✓ LoRA saved to: ${absolutePath}`);
    console.log(`[FFE Download] File size: ${result.data.length} bytes`);
    console.log(`[FFE Download] Model blob hash: ${result.modelBlobHash}`);
    console.log(`[FFE Download] Token ID: ${result.tokenId}`);
    console.log('');
    console.log('Now you can compare this LoRA with your solo-trained model:');
    console.log(`  - Solo LoRA: <your solo model path>`);
    console.log(`  - FFE LoRA: ${absolutePath}`);
    
  } catch (error) {
    console.error('[FFE Download] Error:', error.message);
    process.exit(1);
  }
}

main();

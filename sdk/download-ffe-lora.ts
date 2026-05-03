/**
 * Download and save FFE LoRA file to disk for comparison with solo-trained model.
 * 
 * Usage (from sdk folder):
 *   pnpm exec ts-node download-ffe-lora.ts -- <sessionId> <privateKey> [outputPath]
 * 
 * Or compile to JS and run:
 *   node download-ffe-lora.js <sessionId> <privateKey> [outputPath]
 * 
 * Example:
 *   pnpm exec ts-node download-ffe-lora.ts -- 1 0xabc123... ./ffe-lora.bin
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { FFE } from './src/index.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: ts-node download-ffe-lora.ts -- <sessionId> <privateKey> [outputPath]');
    console.error('');
    console.error('Example:');
    console.error('  pnpm exec ts-node download-ffe-lora.ts -- 1 0xabc123... ./ffe-lora.bin');
    process.exit(1);
  }

  const sessionId = BigInt(args[0]);
  const privateKey = args[1] as `0x${string}`;
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
    const err = error as Error;
    console.error('[FFE Download] Error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

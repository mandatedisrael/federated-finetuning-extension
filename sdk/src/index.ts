/**
 * @0g/ffe — Federated Fine-tuning Extension SDK.
 *
 * v0.1: crypto primitives for sealing keys and producing self-describing
 * encrypted blobs. Coordinator client, storage interface, and high-level
 * `openSession`/`submit`/`download` methods land in subsequent releases.
 */

export * as crypto from "./crypto/index.js";

export {FFEError, InvalidInputError, DecryptionFailedError, type FFEErrorCode} from "./errors.js";

/**
 * SDK error hierarchy. All thrown errors extend `FFEError` so callers can
 * `catch (e: FFEError)` and switch on `e.code`.
 */

export type FFEErrorCode =
    | "INVALID_INPUT"
    | "DECRYPT_FAILED"
    | "ATTESTATION_INVALID"
    | "STORAGE_FAILED"
    | "CHAIN_FAILED"
    | "NOT_FOUND";

export class FFEError extends Error {
    readonly code: FFEErrorCode;

    constructor(code: FFEErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FFEError";
        this.code = code;
    }
}

export class InvalidInputError extends FFEError {
    constructor(message: string) {
        super("INVALID_INPUT", message);
        this.name = "InvalidInputError";
    }
}

export class DecryptionFailedError extends FFEError {
    constructor(message: string, options?: ErrorOptions) {
        super("DECRYPT_FAILED", message, options);
        this.name = "DecryptionFailedError";
    }
}

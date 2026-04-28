import {BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex} from "viem";
import {coordinatorAbi} from "./abi.js";
import {FFEError} from "../errors.js";

/**
 * Typed error for any Coordinator revert. `code` is the contract's custom
 * error name (e.g. "NotParticipant"). Falls back to "Unknown" if the revert
 * data doesn't decode against the vendored ABI.
 */
export type CoordinatorErrorCode =
    | "NotCreator"
    | "NotParticipant"
    | "AlreadySubmitted"
    | "SessionNotFound"
    | "SessionNotOpen"
    | "AggregatorPubkeyNotSet"
    | "AggregatorPubkeyAlreadySet"
    | "InvalidQuorum"
    | "EmptyParticipants"
    | "LengthMismatch"
    | "ZeroAddress"
    | "ZeroHash"
    | "EmptyPubkey"
    | "DuplicateParticipant"
    | "Unknown";

export class CoordinatorError extends FFEError {
    readonly contractCode: CoordinatorErrorCode;

    constructor(contractCode: CoordinatorErrorCode, message: string, options?: ErrorOptions) {
        super("CHAIN_FAILED", message, options);
        this.name = "CoordinatorError";
        this.contractCode = contractCode;
    }
}

/**
 * Walks a viem error chain, finds a `ContractFunctionRevertedError`, and
 * decodes the revert data against `coordinatorAbi`. Returns a typed
 * CoordinatorError. Always throws — never returns undefined — so callers
 * can rely on `try/catch`.
 */
export function rethrowCoordinatorError(cause: unknown): never {
    if (cause instanceof BaseError) {
        const reverted = cause.walk(
            (e) => e instanceof ContractFunctionRevertedError,
        ) as ContractFunctionRevertedError | null;

        if (reverted?.data?.errorName) {
            const name = reverted.data.errorName as CoordinatorErrorCode;
            throw new CoordinatorError(name, `Coordinator reverted: ${name}`, {cause});
        }

        // Some providers surface raw revert data without viem decoding it.
        // Try a manual decode against the ABI as a last resort.
        const raw = (cause as {data?: Hex}).data;
        if (raw && raw.startsWith("0x") && raw.length >= 10) {
            try {
                const decoded = decodeErrorResult({abi: coordinatorAbi, data: raw});
                throw new CoordinatorError(
                    decoded.errorName as CoordinatorErrorCode,
                    `Coordinator reverted: ${decoded.errorName}`,
                    {cause},
                );
            } catch (decodeFailure) {
                // CoordinatorError throws above; only decode failures land here
                if (decodeFailure instanceof CoordinatorError) throw decodeFailure;
            }
        }
    }

    throw new CoordinatorError(
        "Unknown",
        cause instanceof Error ? cause.message : "Coordinator call failed",
        {cause},
    );
}

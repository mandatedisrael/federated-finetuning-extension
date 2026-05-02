import {BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex} from "viem";
import {inftMinterAbi} from "./abi.js";
import {FFEError} from "../errors.js";

export type INFTMinterErrorCode =
    | "NotMinter"
    | "AlreadyMinted"
    | "TokenNotFound"
    | "SessionNotMinted"
    | "ZeroHash"
    | "EmptyContributors"
    | "LengthMismatch"
    | "ZeroAddress"
    | "EmptySealedKey"
    | "Unknown";

export class INFTMinterError extends FFEError {
    readonly contractCode: INFTMinterErrorCode;

    constructor(contractCode: INFTMinterErrorCode, message: string, options?: ErrorOptions) {
        super("CHAIN_FAILED", message, options);
        this.name = "INFTMinterError";
        this.contractCode = contractCode;
    }
}

export function rethrowINFTMinterError(cause: unknown): never {
    if (cause instanceof BaseError) {
        const reverted = cause.walk(
            (e) => e instanceof ContractFunctionRevertedError,
        ) as ContractFunctionRevertedError | null;

        if (reverted?.data?.errorName) {
            const name = reverted.data.errorName as INFTMinterErrorCode;
            throw new INFTMinterError(name, `INFTMinter reverted: ${name}`, {cause});
        }

        const raw = (cause as {data?: Hex}).data;
        if (raw && raw.startsWith("0x") && raw.length >= 10) {
            try {
                const decoded = decodeErrorResult({abi: inftMinterAbi, data: raw});
                throw new INFTMinterError(
                    decoded.errorName as INFTMinterErrorCode,
                    `INFTMinter reverted: ${decoded.errorName}`,
                    {cause},
                );
            } catch (decodeFailure) {
                if (decodeFailure instanceof INFTMinterError) throw decodeFailure;
            }
        }
    }

    throw new INFTMinterError(
        "Unknown",
        cause instanceof Error ? cause.message : "INFTMinter call failed",
        {cause},
    );
}

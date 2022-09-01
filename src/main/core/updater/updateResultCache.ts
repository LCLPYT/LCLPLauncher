import UpdateCheckResult from "../../../common/types/UpdateCheckResult";

let updateCheckResult: UpdateCheckResult | null = null;

export function getCachedUpdateCheckResult() {
    return updateCheckResult;
}

export function setCachedCheckResult(res: UpdateCheckResult | null) {
    updateCheckResult = res;
}
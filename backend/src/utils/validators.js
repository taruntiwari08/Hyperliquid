export function normalizeAddress(address) {
    if (!address || typeof address !== "string") {
        return null;
    }

    const trimmed = address.trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return null;
    }

    return trimmed.toLowerCase();
}

export function validateTradeInput({
    userAddress,
    coin,
    isLong,
    margin,
    leverage,
}) {
    if (!normalizeAddress(userAddress)) return "Invalid user address";

    if (!coin || typeof coin !== "string") {
        return "Invalid coin";
    }

    if (typeof isLong !== "boolean") {
        return "Invalid side";
    }

    if (!margin || isNaN(margin) || Number(margin) <= 0) {
        return "Invalid margin";
    }

    if (!leverage || isNaN(leverage) || Number(leverage) <= 0) {
        return "Invalid leverage";
    }

    return null;
}
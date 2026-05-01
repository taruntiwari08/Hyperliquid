const userLocks = new Map();

export async function withUserLock(userAddress, task) {
    const key = userAddress.toLowerCase();

    const previous = userLocks.get(key) || Promise.resolve();

    let release;

    const current = new Promise((resolve) => {
        release = resolve;
    });

    userLocks.set(key, previous.then(() => current));

    await previous;

    try {
        return await task();
    } finally {
        release();

        if (userLocks.get(key) === current) {
            userLocks.delete(key);
        }
    }
}
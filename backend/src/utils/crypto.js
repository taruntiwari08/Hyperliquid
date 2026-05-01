import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
    const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET;

    if (!secret || secret.length !== 64) {
        throw new Error(
            "Invalid AGENT_KEY_ENCRYPTION_SECRET. Must be 64 hex characters."
        );
    }

    return Buffer.from(secret, "hex");
}

export function encryptPrivateKey(privateKey) {
    const key = getEncryptionKey();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(privateKey, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
        ciphertext: ciphertext.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
    };
}

export function decryptPrivateKey(encryptedPrivateKey) {
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedPrivateKey.iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(encryptedPrivateKey.authTag, "hex"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPrivateKey.ciphertext, "hex")),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}
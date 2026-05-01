import mongoose from "mongoose";

const AgentWalletSchema = new mongoose.Schema(
    {
        userAddress: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
            unique: true,
        },

        agentAddress: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
        },

        agentName: {
            type: String,
            required: true,
        },

        encryptedPrivateKey: {
            ciphertext: {
                type: String,
                required: true,
            },
            iv: {
                type: String,
                required: true,
            },
            authTag: {
                type: String,
                required: true,
            },
        },

        isApproved: {
            type: Boolean,
            default: false,
        },

        validUntil: {
            type: Number,
            required: true,
        },

        lastUsedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("AgentWallet", AgentWalletSchema);
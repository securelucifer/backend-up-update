import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    // Payment Settings
    merchantUPI: {
        type: String,
        required: true,
        trim: true,
        default: 'mstandwafuelcentre@sbi'
    },
    merchantSecret: {
        type: String,
        default: 'my_super_secret_key'
    },

    // Other Settings (for future expansion)
    siteName: {
        type: String,
        default: 'My E-Commerce Store'
    },
    siteEmail: {
        type: String,
        default: 'admin@example.com'
    },

    // Single document tracking
    settingsVersion: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

export default mongoose.model('Settings', settingsSchema);

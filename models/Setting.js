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
        default: 'mysupersecretkey'
    },

    // Other Settings
    siteName: {
        type: String,
        default: 'My E-Commerce Store'
    },
    siteEmail: {
        type: String,
        default: 'admin@example.com'
    },

    // Version tracking
    settingsVersion: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
    try {
        let settings = await this.findOne();
        if (!settings) {
            console.log('📝 Creating default settings document');
            settings = await this.create({});
        }
        return settings;
    } catch (error) {
        console.error('Error in getSettings:', error);
        throw error;
    }
};

export default mongoose.model('Settings', settingsSchema);

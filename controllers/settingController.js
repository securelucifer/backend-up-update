import Settings from '../models/Setting.js';

/**
 * @desc    Get current settings
 * @route   GET /api/settings
 * @access  Public (or add admin auth)
 */
export const getSettings = async (req, res) => {
    try {
        const settings = await Settings.getSettings();

        res.status(200).json({
            success: true,
            data: {
                merchantUPI: settings.merchantUPI,
                siteName: settings.siteName,
                siteEmail: settings.siteEmail
                // Don't send merchantSecret for security
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings',
            message: error.message
        });
    }
};

/**
 * @desc    Update settings
 * @route   PUT /api/settings
 * @access  Admin only (add authentication middleware)
 */
export const updateSettings = async (req, res) => {
    try {
        const { merchantUPI, merchantSecret, siteName, siteEmail } = req.body;

        const settings = await Settings.getSettings();

        // Update fields if provided
        if (merchantUPI) settings.merchantUPI = merchantUPI;
        if (merchantSecret) settings.merchantSecret = merchantSecret;
        if (siteName) settings.siteName = siteName;
        if (siteEmail) settings.siteEmail = siteEmail;

        settings.settingsVersion += 1;
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            data: {
                merchantUPI: settings.merchantUPI,
                siteName: settings.siteName,
                siteEmail: settings.siteEmail
            }
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update settings',
            message: error.message
        });
    }
};

/**
 * @desc    Get merchant UPI (public endpoint)
 * @route   GET /api/settings/merchant-upi
 * @access  Public
 */
export const getMerchantUPI = async (req, res) => {
    try {
        const settings = await Settings.getSettings();

        res.status(200).json({
            success: true,
            upi: settings.merchantUPI
        });
    } catch (error) {
        console.error('Error fetching merchant UPI:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch merchant UPI'
        });
    }
};

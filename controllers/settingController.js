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
                merchantUPI: settings.merchantUPI || '',
                siteName: settings.siteName || '',
                siteEmail: settings.siteEmail || ''
            }
        });
    } catch (error) {
        console.error('❌ Error fetching settings:', error);
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

        // Validate UPI ID format
        if (merchantUPI && !/^[\w.-]+@[\w.-]+$/.test(merchantUPI.trim())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid UPI ID format. Example: yourname@upi'
            });
        }

        const settings = await Settings.getSettings();

        // Update fields if provided
        if (merchantUPI !== undefined) settings.merchantUPI = merchantUPI.trim();
        if (merchantSecret !== undefined) settings.merchantSecret = merchantSecret;
        if (siteName !== undefined) settings.siteName = siteName.trim();
        if (siteEmail !== undefined) settings.siteEmail = siteEmail.trim();

        settings.settingsVersion += 1;

        // Save with error handling
        await settings.save();

        console.log('✅ Settings updated successfully:', {
            merchantUPI: settings.merchantUPI,
            siteName: settings.siteName
        });

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
        console.error('❌ Error updating settings:', error);
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
            upi: settings.merchantUPI || ''
        });
    } catch (error) {
        console.error('❌ Error fetching merchant UPI:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch merchant UPI',
            message: error.message
        });
    }
};

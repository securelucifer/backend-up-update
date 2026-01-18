import express from 'express';
import {
    getSettings,
    updateSettings,
    getMerchantUPI
} from '../controllers/settingController.js';

const router = express.Router();

// Get all settings
router.get('/', getSettings);

// Update settings (add authentication middleware here)
router.put('/', updateSettings);

// Get merchant UPI (public)
router.get('/merchant-upi', getMerchantUPI);

export default router;

import express from 'express';
import { upload } from '../config/cloudinary.js';
import { adminAuth } from '../middleware/auth.js';
import {
    adminLogin,
    adminLogout,
    getAdminProfile,
    createProduct,
    getAdminProducts,
    getAdminProduct,
    updateProduct,
    deleteProduct,
    getAdminStats,
    updateProductRating
} from '../controllers/adminController.js';

const router = express.Router();

// Public routes
router.post('/login', adminLogin);

// Protected admin routes
router.use(adminAuth);

router.post('/logout', adminLogout);
router.get('/profile', getAdminProfile);
router.get('/stats', getAdminStats);


// Product management routes
router.get('/products', getAdminProducts);
router.post('/products', upload.array('images', 5), createProduct);
router.get('/products/:id', getAdminProduct);
router.put('/products/:id', upload.array('images', 5), updateProduct);
router.patch('/products/:id/rating', updateProductRating);
router.delete('/products/:id', deleteProduct);


export default router;

import express from 'express';
import {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  deleteBannerImage
} from '../controllers/bannerController.js';
import { uploadBanners } from '../config/cloudinary.js';

const router = express.Router();

// Get all banners (public route for frontend)
router.get('/', getAllBanners);

// Get single banner
router.get('/:id', getBannerById);

// Create new banner (admin only) - multiple images
router.post('/', uploadBanners.array('images', 10), createBanner);

// Update banner (admin only) - multiple images
router.put('/:id', uploadBanners.array('images', 10), updateBanner);

// Delete banner (admin only)
router.delete('/:id', deleteBanner);

// Delete specific image from banner
router.delete('/:id/images/:imageId', deleteBannerImage);

// Toggle banner status (admin only)
router.patch('/:id/toggle', toggleBannerStatus);

export default router;

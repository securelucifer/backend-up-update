import express from 'express';
import {
    getProducts,
    getProduct,
    getSimilarProducts,
    getFeaturedProducts,
    getTopRatedProducts,
    getTopDeals
} from '../controllers/productController.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/top-rated', getTopRatedProducts);
router.get('/top-deals', getTopDeals);
router.get('/:id', getProduct);
router.get('/:id/similar', getSimilarProducts);

export default router;

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

// Ensure dotenv is loaded first
dotenv.config();

// Debug environment variables
console.log('🔍 Cloudinary Environment Check:');
console.log('CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test connection
const testCloudinaryConnection = async () => {
    try {
        if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
            throw new Error('Cloudinary credentials missing in environment variables');
        }

        const result = await cloudinary.api.ping();
        console.log('☁️ Cloudinary connected successfully');
        return result;
    } catch (error) {
        console.error('☁️ Cloudinary connection failed:', error.message);
        console.error('💡 Please check your .env file for correct Cloudinary credentials');
    }
};

// Configure storage for banners (multiple images)
const bannerStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'banners',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 1920, height: 700, crop: 'fill', quality: 'auto:good' },
            { format: 'auto' }
        ],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return `banner-${uniqueSuffix}`;
        }
    }
});

// Configure storage for products (single images)
const productStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'dmart/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 1000, height: 1000, crop: 'limit', quality: 'auto:good' }
        ],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return `product-${uniqueSuffix}`;
        }
    }
});

// Multiple upload for banners
const uploadBanners = multer({
    storage: bannerStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 10 // Maximum 10 files
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Single upload for products (existing)
const upload = multer({
    storage: productStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
};

// Delete multiple images
const deleteMultipleImages = async (publicIds) => {
    try {
        const result = await cloudinary.api.delete_resources(publicIds);
        return result;
    } catch (error) {
        console.error('Error deleting multiple images:', error);
        throw error;
    }
};

// Test connection on startup
testCloudinaryConnection();

export {
    cloudinary,
    upload,
    uploadBanners,
    deleteImage,
    deleteMultipleImages
};

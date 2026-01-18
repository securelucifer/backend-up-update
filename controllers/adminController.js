import jwt from 'jsonwebtoken';
import Product from '../models/Product.js';
import Admin from '../models/Admin.js';
import { deleteImage, deleteMultipleImages } from '../config/cloudinary.js';
import generateId from '../utils/generateId.js';

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('🔍 Login attempt for username:', username);

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const admin = await Admin.findOne({ username }).select('+password');

        console.log('🔍 Admin found in DB:', admin ? 'YES' : 'NO');

        if (!admin || !admin.isActive) {
            console.log('❌ Admin not found or inactive');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await admin.comparePassword(password);
        console.log('🔍 Password match result:', isMatch);

        if (!isMatch) {
            console.log('❌ Password comparison failed');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        await admin.updateLastLogin();
        const token = generateToken(admin._id);

        console.log('✅ Login successful for:', username);

        res.status(200).json({
            success: true,
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                name: admin.name
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// @desc    Admin logout
// @route   POST /api/admin/logout
// @access  Private
const adminLogout = async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private
const getAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id);

        res.status(200).json({
            success: true,
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
};

// @desc    Create product (FIXED for form-data)
// @route   POST /api/admin/products
// @access  Private
const createProduct = async (req, res) => {
    try {
        console.log('📝 Creating product...');
        console.log('📝 Request body:', req.body);
        console.log('📝 Files received:', req.files ? req.files.length : 0);

        const {
            name, mrp, dmartPrice, weight, pricePerUnit, brand,
            category, isVeg, description, tags, badge, stockQuantity,
            featured, rating, reviewsCount
        } = req.body;

        // Validate required fields
        if (!name || !mrp || !dmartPrice || !weight || !brand || !category || !description) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, mrp, dmartPrice, weight, brand, category, description'
            });
        }

        // Parse and validate numeric fields (form-data sends everything as strings)
        const parsedMrp = parseFloat(mrp);
        const parsedDmartPrice = parseFloat(dmartPrice);
        const parsedRating = rating ? parseFloat(rating) : 4.0;
        const parsedReviewsCount = reviewsCount ? parseInt(reviewsCount) : 0;
        const parsedStockQuantity = stockQuantity ? parseInt(stockQuantity) : 100;

        // Validate parsed values
        if (isNaN(parsedMrp) || isNaN(parsedDmartPrice)) {
            return res.status(400).json({
                success: false,
                message: 'MRP and D-Mart price must be valid numbers'
            });
        }

        if (parsedRating < 0 || parsedRating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 0 and 5'
            });
        }

        if (parsedReviewsCount < 0 || parsedStockQuantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Reviews count and stock quantity cannot be negative'
            });
        }

        // Generate unique product ID
        const productId = generateId();

        // Handle image uploads
        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => ({
                url: file.path,
                public_id: file.filename,
                alt: `${name} - Image`
            }));
            console.log('📸 Images processed:', images.length);
        } else {
            console.log('⚠️ No images uploaded');
        }

        // Parse tags (handle both string and array)
        let parsedTags = [];
        if (tags) {
            if (Array.isArray(tags)) {
                parsedTags = tags.map(tag => tag.trim().toLowerCase());
            } else {
                parsedTags = tags.split(',').map(tag => tag.trim().toLowerCase());
            }
        }

        // Parse boolean fields (form-data sends as strings)
        const parsedIsVeg = isVeg === 'true' || isVeg === true;
        const parsedFeatured = featured === 'true' || featured === true;

        const product = new Product({
            id: productId,
            name: name.trim(),
            images,
            mrp: parsedMrp,
            dmartPrice: parsedDmartPrice,
            weight: weight.trim(),
            pricePerUnit: pricePerUnit ? pricePerUnit.trim() : `₹ ${parsedDmartPrice} / ${weight}`,
            brand: brand.trim(),
            category: category.trim(),
            isVeg: parsedIsVeg,
            description: description.trim(),
            tags: parsedTags,
            badge: badge && badge !== 'null' ? badge.trim() : null,
            stockQuantity: parsedStockQuantity,
            featured: parsedFeatured,
            rating: Math.round(parsedRating * 10) / 10,
            reviewsCount: parsedReviewsCount
        });

        console.log('💾 Saving product with data:', {
            id: product.id,
            name: product.name,
            mrp: product.mrp,
            dmartPrice: product.dmartPrice,
            images: product.images.length,
            rating: product.rating,
            reviewsCount: product.reviewsCount
        });

        await product.save();

        console.log('✅ Product created successfully with ID:', product.id);

        res.status(201).json({
            success: true,
            data: product,
            message: 'Product created successfully'
        });

    } catch (error) {
        console.error('❌ Product creation error:', error);

        // Delete uploaded images if error occurs
        if (req.files && req.files.length > 0) {
            console.log('🗑️ Cleaning up uploaded images due to error...');
            // Note: Add cleanup logic here if needed
        }

        // Send detailed error response
        res.status(500).json({
            success: false,
            message: 'Error creating product',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

// @desc    Get all products for admin
// @route   GET /api/admin/products
// @access  Private
const getAdminProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        let query = {};

        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.category) {
            query.category = { $regex: req.query.category, $options: 'i' };
        }
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }
        if (req.query.minRating) {
            query.rating = { $gte: parseFloat(req.query.minRating) };
        }

        let sort = { createdAt: -1 };
        if (req.query.sortBy) {
            const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
            sort = { [req.query.sortBy]: sortOrder };
        }

        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments(query);

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
};

// @desc    Get single product for admin
// @route   GET /api/admin/products/:id
// @access  Private
const getAdminProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private
const updateProduct = async (req, res) => {
    try {
        let product = await Product.findOne({ id: req.params.id });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Handle new image uploads
        let newImages = [];
        if (req.files && req.files.length > 0) {
            newImages = req.files.map(file => ({
                url: file.path,
                public_id: file.filename,
                alt: `${product.name} - Image`
            }));
        }

        const updateData = { ...req.body };

        // Parse fields for form-data
        if (updateData.mrp) {
            updateData.mrp = parseFloat(updateData.mrp);
        }
        if (updateData.dmartPrice) {
            updateData.dmartPrice = parseFloat(updateData.dmartPrice);
        }
        if (updateData.stockQuantity) {
            updateData.stockQuantity = parseInt(updateData.stockQuantity);
        }
        if (updateData.isVeg !== undefined) {
            updateData.isVeg = updateData.isVeg === 'true' || updateData.isVeg === true;
        }
        if (updateData.featured !== undefined) {
            updateData.featured = updateData.featured === 'true' || updateData.featured === true;
        }

        // Handle rating and reviewsCount
        if (updateData.rating !== undefined) {
            updateData.rating = Math.round(parseFloat(updateData.rating) * 10) / 10;
        }

        if (updateData.reviewsCount !== undefined) {
            updateData.reviewsCount = parseInt(updateData.reviewsCount);
        }

        if (updateData.tags) {
            if (Array.isArray(updateData.tags)) {
                updateData.tags = updateData.tags.map(tag => tag.trim().toLowerCase());
            } else {
                updateData.tags = updateData.tags.split(',').map(tag => tag.trim().toLowerCase());
            }
        }

        // Handle images
        if (req.query.replaceImages === 'true') {
            updateData.images = newImages;
        } else {
            updateData.images = [...(product.images || []), ...newImages];
        }

        product = await Product.findOneAndUpdate(
            { id: req.params.id },
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: product,
            message: 'Product updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete images from Cloudinary
        if (product.images && product.images.length > 0) {
            // Note: Add Cloudinary deletion logic here if needed
        }

        await Product.findOneAndDelete({ id: req.params.id });

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error.message
        });
    }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private
const getAdminStats = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ status: 'active' });
        const inStockProducts = await Product.countDocuments({ inStock: true });
        const outOfStockProducts = await Product.countDocuments({ inStock: false });

        const categoryStats = await Product.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$category', count: { $sum: 1 }, avgRating: { $avg: '$rating' } } },
            { $sort: { count: -1 } }
        ]);

        const recentProducts = await Product.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('id name category dmartPrice images createdAt rating reviewsCount');

        res.status(200).json({
            success: true,
            data: {
                totalProducts,
                activeProducts,
                inStockProducts,
                outOfStockProducts,
                categoryStats,
                recentProducts
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
};

// @desc    Update product rating and reviews
// @route   PATCH /api/admin/products/:id/rating
// @access  Private
const updateProductRating = async (req, res) => {
    try {
        const { rating, reviewsCount } = req.body;

        if (rating !== undefined && (rating < 0 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 0 and 5'
            });
        }

        if (reviewsCount !== undefined && reviewsCount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Reviews count cannot be negative'
            });
        }

        const updateData = {};
        if (rating !== undefined) {
            updateData.rating = Math.round(rating * 10) / 10;
        }
        if (reviewsCount !== undefined) {
            updateData.reviewsCount = reviewsCount;
        }

        const product = await Product.findOneAndUpdate(
            { id: req.params.id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            data: product,
            message: 'Product rating updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating rating',
            error: error.message
        });
    }
};

export {
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
};

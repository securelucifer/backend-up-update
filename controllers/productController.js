import Product from '../models/Product.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        let query = { status: 'active' };

        // Filters
        if (req.query.category) {
            query.category = { $regex: req.query.category, $options: 'i' };
        }
        if (req.query.brand) {
            query.brand = { $regex: req.query.brand, $options: 'i' };
        }
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }
        if (req.query.featured === 'true') {
            query.featured = true;
        }
        if (req.query.minRating) {
            query.rating = { $gte: parseFloat(req.query.minRating) };
        }

        // Sort
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

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
    try {
        const product = await Product.findOne({
            id: req.params.id,
            status: 'active'
        });

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

// @desc    Get similar products
// @route   GET /api/products/:id/similar
// @access  Public
export const getSimilarProducts = async (req, res) => {
    try {
        const product = await Product.findOne({
            id: req.params.id,
            status: 'active'
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const similarProducts = await Product.find({
            id: { $ne: product.id },
            status: 'active',
            $or: [
                { category: product.category },
                { brand: product.brand },
                { tags: { $in: product.tags } }
            ]
        })
            .limit(8)
            .sort({ rating: -1 });

        res.status(200).json({
            success: true,
            data: similarProducts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching similar products',
            error: error.message
        });
    }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const products = await Product.find({
            $or: [
                { featured: true },
                { discountPercent: { $gte: 20 } }
            ],
            status: 'active',
            inStock: true
        })
            .sort({ discountPercent: -1, rating: -1 })
            .limit(limit);

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured products',
            error: error.message
        });
    }
};

// @desc    Get top rated products
// @route   GET /api/products/top-rated
// @access  Public
export const getTopRatedProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const minRating = parseFloat(req.query.minRating) || 4.0;

        const products = await Product.find({
            status: 'active',
            inStock: true,
            rating: { $gte: minRating }
        })
            .sort({ rating: -1, reviewsCount: -1 })
            .limit(limit);

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching top rated products',
            error: error.message
        });
    }
};

// @desc    Get top deals products - FIXED FUNCTION
// @route   GET /api/products/top-deals
// @access  Public
export const getTopDeals = async (req, res) => {
    try {
        console.log('🔥 Top deals endpoint called with params:', req.query);

        const limit = parseInt(req.query.limit) || 50;
        const minDiscount = parseInt(req.query.minDiscount) || 5;
        const minDiscountAmount = parseInt(req.query.minDiscountAmount) || 10;

        console.log('🔍 Searching for products with:', {
            limit,
            minDiscount: `${minDiscount}%`,
            minDiscountAmount: `₹${minDiscountAmount}`
        });

        // Check if we have any products first
        const totalProducts = await Product.countDocuments({ status: 'active' });
        console.log('📊 Total active products:', totalProducts);

        if (totalProducts === 0) {
            console.log('🌱 Database empty, inserting sample data...');
            await insertSampleDeals();
        }

        const products = await Product.find({
            status: 'active',
            inStock: true,
            $and: [
                { discountPercent: { $gte: minDiscount } },
                { discount: { $gte: minDiscountAmount } }
            ]
        })
            .sort({
                discountPercent: -1,
                discount: -1,
                rating: -1
            })
            .limit(limit);

        console.log('✅ Found top deals:', products.length);

        res.status(200).json({
            success: true,
            data: products,
            message: `Top ${products.length} deals found`
        });
    } catch (error) {
        console.error('❌ Error in getTopDeals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching top deals',
            error: error.message
        });
    }
};

// Helper function to insert sample deals if database is empty
const insertSampleDeals = async () => {
    const sampleDeals = [
        {
            id: 'deal001',
            name: 'Gemini Sunflower Oil Tin',
            images: [{
                url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'sunflower_oil',
                alt: 'Gemini Sunflower Oil'
            }],
            mrp: 2500,
            dmartPrice: 2229,
            discount: 271,
            discountPercent: 11,
            weight: '13 kg',
            pricePerUnit: '₹ 171.46 / 1 kg',
            brand: 'Gemini',
            category: 'Grocery & Staples',
            description: 'Premium quality sunflower oil for healthy cooking',
            isVeg: true,
            rating: 4.3,
            reviewsCount: 89,
            inStock: true,
            stockQuantity: 150,
            status: 'active',
            badge: 'GREAT VALUE',
            featured: false,
            tags: ['oil', 'cooking', 'healthy', 'sunflower']
        },
        {
            id: 'deal002',
            name: 'Bikaji Bhujia Special Pack',
            images: [{
                url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'bhujia',
                alt: 'Bikaji Bhujia'
            }],
            mrp: 350,
            dmartPrice: 209,
            discount: 141,
            discountPercent: 40,
            weight: '1 kg',
            pricePerUnit: '₹ 0.21 / 1 g',
            brand: 'Bikaji',
            category: 'Snacks & Branded Foods',
            description: 'Crispy and spicy traditional Indian snack made from gram flour',
            isVeg: true,
            rating: 4.5,
            reviewsCount: 234,
            inStock: true,
            stockQuantity: 200,
            status: 'active',
            badge: 'BESTSELLER',
            featured: true,
            tags: ['snacks', 'spicy', 'traditional', 'bhujia']
        },
        {
            id: 'deal003',
            name: 'Chings Schezwan Chutney',
            images: [{
                url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'chutney',
                alt: 'Schezwan Chutney'
            }],
            mrp: 180,
            dmartPrice: 99,
            discount: 81,
            discountPercent: 45,
            weight: '590 g',
            pricePerUnit: '₹ 0.17 / 1 g',
            brand: 'Chings',
            category: 'Food & Beverage',
            description: 'Spicy and tangy Schezwan sauce perfect for Indo-Chinese dishes',
            isVeg: true,
            rating: 4.2,
            reviewsCount: 156,
            inStock: true,
            stockQuantity: 180,
            status: 'active',
            badge: 'TOP RATED',
            featured: false,
            tags: ['sauce', 'schezwan', 'spicy', 'chinese']
        },
        {
            id: 'deal004',
            name: 'McCain French Fries Premium',
            images: [{
                url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'fries',
                alt: 'McCain French Fries'
            }],
            mrp: 125,
            dmartPrice: 99,
            discount: 26,
            discountPercent: 21,
            weight: '420 g',
            pricePerUnit: '₹ 0.24 / 1 g',
            brand: 'McCain',
            category: 'Frozen Food',
            description: 'Crispy golden french fries made from premium potatoes',
            isVeg: true,
            rating: 4.4,
            reviewsCount: 67,
            inStock: true,
            stockQuantity: 120,
            status: 'active',
            badge: 'FRESH',
            featured: false,
            tags: ['frozen', 'fries', 'potato', 'crispy']
        },
        {
            id: 'deal005',
            name: 'Britannia Marie Gold Biscuits',
            images: [{
                url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'marie_gold',
                alt: 'Britannia Marie Gold'
            }],
            mrp: 50,
            dmartPrice: 42,
            discount: 8,
            discountPercent: 16,
            weight: '350 g',
            pricePerUnit: '₹ 0.12 / 1 g',
            brand: 'Britannia',
            category: 'Biscuits & Cookies',
            description: 'Light and crispy tea-time biscuits perfect with tea or coffee',
            isVeg: true,
            rating: 4.1,
            reviewsCount: 423,
            inStock: true,
            stockQuantity: 300,
            status: 'active',
            badge: 'LIMITED TIME',
            featured: false,
            tags: ['biscuits', 'tea', 'crispy', 'marie']
        },
        {
            id: 'deal006',
            name: 'Maggi 2-Minute Noodles Family Pack',
            images: [{
                url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                public_id: 'maggi',
                alt: 'Maggi Noodles'
            }],
            mrp: 120,
            dmartPrice: 95,
            discount: 25,
            discountPercent: 21,
            weight: '840 g (12 packs)',
            pricePerUnit: '₹ 7.92 / 1 pack',
            brand: 'Maggi',
            category: 'Instant Food',
            description: 'Quick and delicious instant noodles ready in 2 minutes',
            isVeg: true,
            rating: 4.6,
            reviewsCount: 892,
            inStock: true,
            stockQuantity: 250,
            status: 'active',
            badge: 'BESTSELLER',
            featured: true,
            tags: ['noodles', 'instant', 'quick', 'maggi']
        }
    ];

    try {
        await Product.insertMany(sampleDeals);
        console.log('✅ Sample deals inserted successfully!');
    } catch (error) {
        if (error.code === 11000) {
            console.log('ℹ️ Sample data already exists, skipping insertion');
        } else {
            console.error('❌ Error inserting sample deals:', error);
        }
    }
};

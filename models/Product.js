import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        unique: true,
        required: true
    },
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        },
        alt: {
            type: String,
            default: ''
        }
    }],
    mrp: {
        type: Number,
        required: [true, 'MRP is required'],
        min: [0, 'MRP cannot be negative']
    },
    dmartPrice: {
        type: Number,
        required: [true, 'D-Mart price is required'],
        min: [0, 'Price cannot be negative']
    },
    discount: {
        type: Number,
        default: 0
    },
    discountPercent: {
        type: Number,
        default: 0
    },
    weight: {
        type: String,
        required: [true, 'Weight is required'],
        trim: true
    },
    pricePerUnit: {
        type: String,
        required: [true, 'Price per unit is required'],
        trim: true
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true,
        index: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        index: true
    },
    isVeg: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        min: [0, 'Rating cannot be less than 0'],
        max: [5, 'Rating cannot be more than 5'],
        default: 4.0,
        validate: {
            validator: function (value) {
                return Math.round(value * 10) === value * 10;
            },
            message: 'Rating can have at most 1 decimal place'
        }
    },
    reviewsCount: {
        type: Number,
        min: [0, 'Reviews count cannot be negative'],
        default: 0
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    inStock: {
        type: Boolean,
        default: true
    },
    stockQuantity: {
        type: Number,
        min: [0, 'Stock quantity cannot be negative'],
        default: 100
    },
    badge: {
        type: String,
        enum: ['FRESH', 'BESTSELLER', 'TOP RATED', 'GREAT VALUE', 'LIMITED TIME', 'NEW'],
        default: null
    },
    featured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Indexes
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ rating: -1 });

// Pre-save middleware
productSchema.pre('save', function (next) {
    if (this.mrp && this.dmartPrice) {
        this.discount = this.mrp - this.dmartPrice;
        this.discountPercent = Math.round(((this.mrp - this.dmartPrice) / this.mrp) * 100);
    }
    this.inStock = this.stockQuantity > 0;
    next();
});

// Static method to get top-rated products
productSchema.statics.getTopRated = function (limit = 10) {
    return this.find({
        status: 'active',
        rating: { $gte: 4.0 }
    })
        .sort({ rating: -1, reviewsCount: -1 })
        .limit(limit);
};

// Static method to get products by rating range
productSchema.statics.getByRatingRange = function (minRating, maxRating) {
    return this.find({
        status: 'active',
        rating: { $gte: minRating, $lte: maxRating }
    }).sort({ rating: -1 });
};

export default mongoose.model('Product', productSchema);

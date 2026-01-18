import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // User information
  userId: {
    type: String,
    required: false,
    index: true
  },

  // Order details
  orderNumber: {
    type: String,
    required: true,
  },

  // Delivery Address
  deliveryAddress: {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    }
  },

  // ✅ REMOVED cardDetails schema completely

  // Products - Updated to match your Product model
  products: [{
    productId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    brand: {
      type: String,
      required: true
    },
    weight: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: false
    },
    category: {
      type: String,
      required: false
    },
    mrp: {
      type: Number,
      required: true
    },
    dmartPrice: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    discountPercent: {
      type: Number,
      default: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    totalPrice: {
      type: Number,
      required: true
    },
    isVeg: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.0
    }
  }],

  // Order totals
  orderSummary: {
    totalItems: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    },
    totalMRP: {
      type: Number,
      required: true
    },
    totalSavings: {
      type: Number,
      required: true
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    deliveryFee: {
      type: Number,
      required: true
    },
    finalTotal: {
      type: Number,
      required: true
    }
  },

  // Coupon information
  couponUsed: {
    code: {
      type: String,
      required: false
    },
    discount: {
      type: Number,
      default: 0
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: false
    }
  },

  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },

  // Payment information
  paymentMethod: {
    type: String,
    enum: ['cod', 'online'],
    default: 'online'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },

  // Data source
  dataSource: {
    type: String,
    enum: ['cart', 'buyNow'],
    required: true
  }

}, {
  timestamps: true
});

// Index for faster queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Generate order number before saving
orderSchema.pre('save', function (next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${random}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order;

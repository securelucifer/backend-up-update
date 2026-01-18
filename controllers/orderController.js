import Order from '../models/Order.js';
import Product from '../models/Product.js';

// Create new order
export const createOrder = async (req, res) => {
    try {
        const {
            userId,
            deliveryAddress,
            products,
            orderSummary,
            couponUsed,
            paymentMethod,
            dataSource
        } = req.body;

        // Validation
        if (!deliveryAddress || !products || !orderSummary) {
            return res.status(400).json({
                success: false,
                error: 'Missing required order information'
            });
        }

        // Validate products array
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one product is required'
            });
        }

        // Generate order number manually
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const orderNumber = `ORD${timestamp}${random}`;

        // Validate and process products
        const processedProducts = [];
        for (const product of products) {
            // Verify product exists in database
            const existingProduct = await Product.findOne({ id: product.id, status: 'active' });

            if (!existingProduct) {
                return res.status(400).json({
                    success: false,
                    error: `Product with ID ${product.id} not found or inactive`
                });
            }

            // Check stock availability
            if (existingProduct.stockQuantity < product.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient stock for ${existingProduct.name}. Available: ${existingProduct.stockQuantity}, Requested: ${product.quantity}`
                });
            }

            processedProducts.push({
                productId: product.id,
                name: existingProduct.name,
                brand: existingProduct.brand,
                weight: existingProduct.weight,
                image: existingProduct.images[0]?.url || '',
                category: existingProduct.category,
                mrp: existingProduct.mrp,
                dmartPrice: existingProduct.dmartPrice,
                discount: existingProduct.discount,
                discountPercent: existingProduct.discountPercent,
                quantity: product.quantity,
                totalPrice: existingProduct.dmartPrice * product.quantity,
                isVeg: existingProduct.isVeg,
                rating: existingProduct.rating
            });

            // Update stock quantity (optional - uncomment if you want to reduce stock)
            // await Product.findOneAndUpdate(
            //   { id: product.id },
            //   { $inc: { stockQuantity: -product.quantity } }
            // );
        }

        // Create new order
        const newOrder = new Order({
            orderNumber: orderNumber,
            userId: userId || null,
            deliveryAddress,
            products: processedProducts,
            orderSummary,
            couponUsed: couponUsed || {},
            paymentMethod: paymentMethod || 'online',
            dataSource: dataSource || 'cart'
        });

        const savedOrder = await newOrder.save();

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId: savedOrder._id,
                orderNumber: savedOrder.orderNumber,
                status: savedOrder.status,
                finalTotal: savedOrder.orderSummary.finalTotal,
                productCount: savedOrder.products.length,
                createdAt: savedOrder.createdAt
            }
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            message: error.message
        });
    }
};

// Get all orders with product details
export const getAllOrders = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        let query = {};

        if (userId) {
            query.userId = userId;
        }

        if (status) {
            query.status = status;
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v');

        const totalOrders = await Order.countDocuments(query);

        res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                hasNextPage: page < Math.ceil(totalOrders / limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Orders fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders',
            message: error.message
        });
    }
};

// Get single order by ID
export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('Received order ID:', id);

        // Validate the ID parameter
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Valid order ID is required'
            });
        }

        // Check if ID is a valid MongoDB ObjectId (24 hex characters)
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(id).select('-__v');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error('Order fetch error:', error);
        // Handle specific MongoDB errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch order',
            message: error.message
        });
    }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order status'
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                orderId: updatedOrder._id,
                orderNumber: updatedOrder.orderNumber,
                status: updatedOrder.status
            }
        });

    } catch (error) {
        console.error('Order status update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order status',
            message: error.message
        });
    }
};

// Get order by order number
export const getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber }).select('-__v');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error('Order fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order',
            message: error.message
        });
    }
};

// Delete order
export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('Attempting to delete order with ID:', id);

        // Validate the ID parameter
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Valid order ID is required'
            });
        }

        // Check if ID is a valid MongoDB ObjectId (24 hex characters)
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        // Find the order first to check if it exists
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        console.log('Found order to delete:', order.orderNumber);

        // Delete the order
        await Order.findByIdAndDelete(id);

        console.log('Order deleted successfully:', order.orderNumber);

        res.status(200).json({
            success: true,
            message: 'Order deleted successfully',
            data: {
                orderId: id,
                orderNumber: order.orderNumber
            }
        });

    } catch (error) {
        console.error('Order delete error:', error);

        // Handle specific MongoDB errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to delete order',
            message: error.message
        });
    }
};

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import routes
import productRoutes from './routes/productRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import apkRoutes from './routes/apkRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import settingsRoutes from './routes/settingRoutes.js';

// Import database config
import connectDB from './config/database.js';

// ES6 __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Connect to MongoDB with error handling
connectDB().catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    // Don't exit, allow retry
});

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

// CORS configuration - WORKING VERSION
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.ADMIN_FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174'
        ].filter(Boolean);

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all in development
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// This single line handles everything including OPTIONS requests
app.use(cors(corsOptions));



// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - FIXED (more lenient)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute (changed from 15)
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Very high for dev
    message: {
        success: false,
        error: 'Too many requests. Please try again in a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for certain routes
        const skipPaths = [
            '/health',
            '/api/apk-status',
            '/api/settings/merchant-upi',
            '/api/settings'
        ];
        return skipPaths.some(path => req.path.includes(path));
    },
    handler: (req, res) => {
        console.warn(`⚠️ Rate limit hit: ${req.ip} on ${req.path}`);
        res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again in 1 minute.',
            retryAfter: 60
        });
    }
});

// Apply to API routes only
app.use('/api/', limiter);

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// APK Download Route
app.get('/api/download/apk', (req, res) => {
    try {
        const apkPath = path.join(__dirname, 'public', 'downloads', 'dmart-app.apk');

        if (!fs.existsSync(apkPath)) {
            return res.status(404).json({
                success: false,
                error: 'APK file not found. Please contact support.'
            });
        }

        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="DMart-App.apk"');
        res.setHeader('Content-Length', fs.statSync(apkPath).size);

        res.download(apkPath, 'DMart-App.apk', (err) => {
            if (err && !res.headersSent) {
                console.error('Error downloading APK:', err);
                res.status(500).json({
                    success: false,
                    error: 'Error occurred while downloading file'
                });
            }
        });
    } catch (error) {
        console.error('APK download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Server error' });
        }
    }
});

// Alternative APK serving route
app.get('/api/download-apk', (req, res) => {
    try {
        const apkPath = path.join(__dirname, 'public', 'downloads', 'dmart-app.apk');

        if (!fs.existsSync(apkPath)) {
            return res.status(404).json({
                success: false,
                error: 'APK file not found'
            });
        }

        res.download(apkPath, 'DMart-App.apk');
    } catch (error) {
        console.error('APK download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Server error' });
        }
    }
});

// Check APK availability endpoint
app.get('/api/apk-status', (req, res) => {
    try {
        const apkPath = path.join(__dirname, 'public', 'downloads', 'dmart-app.apk');
        const exists = fs.existsSync(apkPath);
        let fileInfo = null;

        if (exists) {
            const stats = fs.statSync(apkPath);
            fileInfo = {
                size: stats.size,
                modified: stats.mtime,
                downloadUrl: '/api/download/apk'
            };
        }

        res.json({
            success: true,
            available: exists,
            fileInfo: fileInfo
        });
    } catch (error) {
        console.error('APK status error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/apk', apkRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler for API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

// Global error handling middleware - ENHANCED
app.use((err, req, res, next) => {
    console.error('❌ Global Error Handler:', err);

    // Prevent server crash - always send response
    if (res.headersSent) {
        return next(err);
    }

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB per file.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error: ' + err.message
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        return res.status(400).json({
            success: false,
            message: `${field || 'Field'} already exists`
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // MongoDB errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        return res.status(500).json({
            success: false,
            message: 'Database error occurred'
        });
    }

    // Default error
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Cleanup expired transactions - run every hour
let cleanupInterval;
try {
    cleanupInterval = setInterval(async () => {
        try {
            const { default: Transaction } = await import('./models/Transaction.js');
            if (Transaction.expireOldTransactions) {
                await Transaction.expireOldTransactions();
                console.log('✅ Expired old pending transactions');
            }
        } catch (error) {
            console.error('Error expiring transactions:', error.message);
        }
    }, 3600000); // 1 hour
} catch (error) {
    console.error('Failed to setup cleanup interval:', error);
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`🔧 Admin Frontend URL: ${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}`);
    console.log(`📱 APK download: http://localhost:${PORT}/api/download/apk`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Prevent server timeout
server.timeout = 0;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} signal received: closing HTTP server gracefully`);

    // Clear cleanup interval
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }

    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections - DON'T EXIT
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process - just log it
});

// Handle uncaught exceptions - DON'T EXIT
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit the process - just log it
});

export default app;

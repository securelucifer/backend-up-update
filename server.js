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

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL,
        process.env.ADMIN_FRONTEND_URL,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// APK Download Route
app.get('/api/download/apk', (req, res) => {
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
        if (err) {
            console.error('Error downloading APK:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Error occurred while downloading file'
                });
            }
        } else {
            console.log('APK downloaded successfully');
        }
    });
});

// Alternative direct APK serving route
app.get('/api/download-apk', (req, res) => {
    const apkPath = path.join(__dirname, 'public', 'downloads', 'dmart-app.apk');

    if (!fs.existsSync(apkPath)) {
        return res.status(404).json({
            success: false,
            error: 'APK file not found'
        });
    }

    res.download(apkPath, 'DMart-App.apk');
});

// Check APK availability endpoint
app.get('/api/apk-status', (req, res) => {
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
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
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

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Global Error Handler:', err);

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB per file.'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 5 files allowed.'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected file field. Use "images" as field name.'
            });
        }
        return res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`
        });
    }

    // Cloudinary/Image errors
    if (err.message && err.message.includes('Only image files are allowed')) {
        return res.status(400).json({
            success: false,
            message: 'Only image files (jpg, jpeg, png, webp) are allowed'
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`
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

    // Default error
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Cleanup expired transactions (run every hour)
setInterval(async () => {
    try {
        const { default: Transaction } = await import('./models/Transaction.js');
        if (Transaction.expireOldTransactions) {
            await Transaction.expireOldTransactions();
            console.log('🧹 Expired old pending transactions');
        }
    } catch (error) {
        console.error('Error expiring transactions:', error);
    }
}, 3600000);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`⚡ Admin Frontend URL: ${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}`);
    console.log(`📱 APK download available at: http://localhost:${PORT}/api/download/apk`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('unhandledRejection', (err) => {
    console.log(`Error: ${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});

export default app;

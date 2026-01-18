import express from 'express';
import multer from 'multer';
import {
    uploadApk,
    getApkStatus,
    downloadApk
} from '../controllers/apkController.js';
import { adminAuth } from '../middleware/auth.js';

const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });
const router = express.Router();

router.get('/status', getApkStatus);
router.get('/download', downloadApk);
router.post('/upload', adminAuth, upload.single('apk'), uploadApk);

export default router;

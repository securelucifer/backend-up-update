import Apk from '../models/Apk.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

export const uploadApk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'APK file required'
            });
        }

        const upload = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'raw',           // IMPORTANT for .apk
            folder: 'apk',
            public_id: `dmart_${Date.now()}`
        });

        fs.unlinkSync(req.file.path);    // remove temp file

        // delete previous apk if any
        const old = await Apk.findOne();
        if (old) {
            await cloudinary.uploader.destroy(old.publicId, { resource_type: 'raw' });
            await Apk.deleteOne({ _id: old._id });
        }

        const apk = await Apk.create({
            filename: req.file.originalname,
            url: upload.secure_url,
            size: req.file.size,
            version: req.body.version || '1.0.0',
            publicId: upload.public_id,
            updatedBy: req.admin?.email || 'admin'
        });

        res.status(201).json({
            success: true,
            data: apk,
            message: 'APK uploaded'
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
};

export const getApkStatus = async (_req, res) => {
    try {
        const apk = await Apk.findOne();
        res.json({
            success: true,
            available: !!apk,
            fileInfo: apk
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const downloadApk = async (_req, res) => {
    try {
        const apk = await Apk.findOne();
        if (!apk) {
            return res.status(404).json({
                success: false,
                error: 'APK not found'
            });
        }
        res.redirect(apk.url);            // Cloudinary serves the file
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

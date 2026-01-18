import mongoose from 'mongoose';

const apkSchema = new mongoose.Schema(
    {
        filename: { type: String, required: true },
        url: { type: String, required: true },   // Cloudinary secure URL
        size: Number,                           // bytes
        version: String,                           // e.g. 1.0.4
        publicId: { type: String, required: true },   // Cloudinary public ID
        updatedBy: String
    },
    { timestamps: true }
);


export default mongoose.model('Apk', apkSchema);

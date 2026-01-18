import Banner from '../models/Banner.js';
import { v2 as cloudinary } from 'cloudinary';

// Get all banners
export const getAllBanners = async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = {};
    if (active === 'true') {
      query.isActive = true;
    }

    const banners = await Banner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      data: banners,
      count: banners.length
    });

  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch banners',
      message: error.message
    });
  }
};

// Get single banner by ID
export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Banner ID is required'
      });
    }

    const banner = await Banner.findById(id).select('-__v');

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      data: banner
    });

  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch banner',
      message: error.message
    });
  }
};

// Create new banner with multiple Cloudinary uploads
export const createBanner = async (req, res) => {
  let uploadedImages = [];

  try {
    const { title, description, isActive = true, order = 0, primaryImageIndex = 0 } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one banner image is required'
      });
    }

    console.log(`📸 Uploading ${req.files.length} banner images to Cloudinary...`);

    // Upload all images to Cloudinary
    const uploadPromises = req.files.map(async (file, index) => {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'banners',
        resource_type: 'image',
        transformation: [
          { width: 1920, height: 700, crop: 'fill', quality: 'auto:good' },
          { format: 'auto' }
        ]
      });

      uploadedImages.push(uploadResult);

      return {
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        isPrimary: index === parseInt(primaryImageIndex)
      };
    });

    const images = await Promise.all(uploadPromises);

    console.log(`✅ ${images.length} images uploaded successfully`);

    // Create banner in database
    const newBanner = new Banner({
      title: title.trim(),
      description: description?.trim() || '',
      images: images,
      isActive: isActive === 'true' || isActive === true,
      order: parseInt(order) || 0
    });

    const savedBanner = await newBanner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: savedBanner
    });

  } catch (error) {
    console.error('❌ Create banner error:', error);

    // Clean up uploaded images if banner creation fails
    if (uploadedImages.length > 0) {
      try {
        const publicIds = uploadedImages.map(img => img.public_id);
        await cloudinary.api.delete_resources(publicIds);
        console.log('🧹 Cleaned up uploaded images after error');
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded images:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create banner',
      message: error.message
    });
  }
};

// Update banner
export const updateBanner = async (req, res) => {
  let uploadedImages = [];

  try {
    const { id } = req.params;
    const { title, description, isActive, order, primaryImageIndex = 0, keepExistingImages = 'false' } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Banner ID is required'
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    // Update fields
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (order !== undefined) updateData.order = parseInt(order) || 0;

    // Handle image updates
    if (req.files && req.files.length > 0) {
      console.log(`📸 Updating banner with ${req.files.length} new images...`);

      // If not keeping existing images, delete old ones
      if (keepExistingImages !== 'true') {
        const oldPublicIds = banner.images.map(img => img.publicId);
        if (oldPublicIds.length > 0) {
          try {
            await cloudinary.api.delete_resources(oldPublicIds);
            console.log('🗑️ Deleted old images from Cloudinary');
          } catch (deleteError) {
            console.error('⚠️ Failed to delete old images:', deleteError);
          }
        }
      }

      // Upload new images
      const uploadPromises = req.files.map(async (file, index) => {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: 'banners',
          resource_type: 'image',
          transformation: [
            { width: 1920, height: 700, crop: 'fill', quality: 'auto:good' },
            { format: 'auto' }
          ]
        });

        uploadedImages.push(uploadResult);

        return {
          imageUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          isPrimary: index === parseInt(primaryImageIndex)
        };
      });

      const newImages = await Promise.all(uploadPromises);

      if (keepExistingImages === 'true') {
        // Merge with existing images
        const existingImages = banner.images.map(img => ({
          ...img.toObject(),
          isPrimary: false // Reset primary status
        }));
        updateData.images = [...existingImages, ...newImages];
      } else {
        // Replace all images
        updateData.images = newImages;
      }
    } else if (primaryImageIndex !== undefined && banner.images.length > 0) {
      // Just update primary image index
      const updatedImages = banner.images.map((img, index) => ({
        ...img.toObject(),
        isPrimary: index === parseInt(primaryImageIndex)
      }));
      updateData.images = updatedImages;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: updatedBanner
    });

  } catch (error) {
    console.error('Update banner error:', error);

    // Clean up uploaded images if update fails
    if (uploadedImages.length > 0) {
      try {
        const publicIds = uploadedImages.map(img => img.public_id);
        await cloudinary.api.delete_resources(publicIds);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded images:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update banner',
      message: error.message
    });
  }
};

// Delete banner
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Banner ID is required'
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    console.log('🗑️ Deleting banner:', banner.title);

    // Delete all images from Cloudinary
    if (banner.images && banner.images.length > 0) {
      try {
        const publicIds = banner.images.map(img => img.publicId);
        await cloudinary.api.delete_resources(publicIds);
        console.log(`✅ ${publicIds.length} images deleted from Cloudinary`);
      } catch (cloudinaryError) {
        console.error('⚠️ Failed to delete images from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete banner from database
    await Banner.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
      data: {
        id: banner._id,
        title: banner.title
      }
    });

  } catch (error) {
    console.error('❌ Delete banner error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete banner',
      message: error.message
    });
  }
};

// Toggle banner status
export const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Banner ID is required'
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });

  } catch (error) {
    console.error('Toggle banner status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle banner status',
      message: error.message
    });
  }
};

// Delete specific image from banner
export const deleteBannerImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    const imageIndex = banner.images.findIndex(img => img._id.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    const imageToDelete = banner.images[imageIndex];

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(imageToDelete.publicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete image from Cloudinary:', cloudinaryError);
    }

    // Remove from banner
    banner.images.splice(imageIndex, 1);

    // If deleted image was primary and there are remaining images, make first one primary
    if (imageToDelete.isPrimary && banner.images.length > 0) {
      banner.images[0].isPrimary = true;
    }

    
    await banner.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: banner
    });

  } catch (error) {
    console.error('Delete banner image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image',
      message: error.message
    });
  }
};

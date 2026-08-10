import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload image to Cloudinary
 * @param imageData Base64 encoded image data or file path
 * @param folder Folder name in Cloudinary
 * @param publicId Optional public ID for the image
 * @returns Secure URL of uploaded image
 */
export const uploadImage = async (
    imageData: string,
    folder: string = 'avatars',
    publicId?: string
): Promise<string> => {
    try {
        console.log('[Cloudinary] Starting upload:', {
            folder,
            publicId,
            dataLength: imageData?.length || 0,
            hasData: !!imageData,
            dataPreview: imageData?.substring(0, 50) || 'no data'
        });

        const uploadResult = await cloudinary.uploader.upload(imageData, {
            folder,
            ...(publicId && { public_id: publicId }),
            overwrite: true,
            resource_type: 'auto'
        });

        console.log('[Cloudinary] Upload successful:', {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id
        });

        return uploadResult.secure_url;
    } catch (error: any) {
        console.error('[Cloudinary] Upload error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            response: error.response?.data || error.response || 'no response',
            statusCode: error.statusCode || error.status || 'no status'
        });
        throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Delete image from Cloudinary
 * @param publicId Public ID of the image to delete
 */
export const deleteImage = async (publicId: string): Promise<void> => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
        console.error('Cloudinary delete error:', error);
        throw new Error('Failed to delete image');
    }
};

/**
 * Extract public ID from Cloudinary URL
 * @param url Cloudinary image URL
 * @returns Public ID
 */
export const getPublicIdFromUrl = (url: string): string => {
    // Extract public ID from URL like:
    // https://res.cloudinary.com/cloud-name/image/upload/v123456/folder/image.jpg
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const publicId = `${folder}/${filename.split('.')[0]}`;
    return publicId;
};

export default cloudinary;

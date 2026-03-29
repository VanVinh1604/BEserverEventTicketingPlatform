const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

const useCloudinary =
  String(process.env.USE_CLOUDINARY || "").toLowerCase() === "true" &&
  hasCloudinaryConfig;

if (!useCloudinary) {
  throw new Error(
    "Cloudinary-only mode: please set USE_CLOUDINARY=true and configure CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET"
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "events",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
  },
});

const fileFilter = (_req, file, cb) => {
  const mime = String(file.mimetype || "").toLowerCase();
  if (mime.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image files are allowed"), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

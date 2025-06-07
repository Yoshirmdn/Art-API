import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validateArtworkData = (req, res, next) => {
  const { title, description, category, origin, artist, createdDate, status } =
    req.body;

  const errors = [];

  if (!title || title.trim().length === 0) {
    errors.push("Title harus diisi");
  }
  if (!description || description.trim().length === 0) {
    errors.push("Description harus diisi");
  }
  if (!category || category.trim().length === 0) {
    errors.push("Category harus diisi");
  }
  if (!origin || origin.trim().length === 0) {
    errors.push("Origin harus diisi");
  }
  if (!artist || artist.trim().length === 0) {
    errors.push("Artist harus diisi");
  }
  if (!createdDate || !isValidDate(createdDate)) {
    errors.push("Created date harus valid");
  }
  if (
    status === undefined ||
    status === null ||
    ![0, 1, "0", "1"].includes(status)
  ) {
    errors.push("Status harus 0 atau 1");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors,
    });
  }

  next();
};

const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
};

// Data operations
class ArtworkService {
  static async readData() {
    try {
      const data = await fs.readFile(DATA_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  static async writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  static async findById(id) {
    const data = await this.readData();
    return data.find((item) => item.id === id);
  }

  static async create(artworkData) {
    const data = await this.readData();
    const newArtwork = {
      id: uuidv4(),
      ...artworkData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.push(newArtwork);
    await this.writeData(data);
    return newArtwork;
  }

  static async update(id, artworkData) {
    const data = await this.readData();
    const index = data.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updatedArtwork = {
      ...data[index],
      ...artworkData,
      updatedAt: new Date().toISOString(),
    };

    data[index] = updatedArtwork;
    await this.writeData(data);
    return updatedArtwork;
  }

  static async delete(id) {
    const data = await this.readData();
    const itemIndex = data.findIndex((item) => item.id === id);

    if (itemIndex === -1) {
      return null;
    }

    const deletedItem = data[itemIndex];
    data.splice(itemIndex, 1);
    await this.writeData(data);
    return deletedItem;
  }
}

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureDirectoryExists(UPLOADS_DIR);
      cb(null, UPLOADS_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `artwork-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const deleteOldImage = async (imageUrl) => {
  try {
    if (imageUrl) {
      const filename = path.basename(imageUrl);
      const filepath = path.join(UPLOADS_DIR, filename);
      await fs.unlink(filepath);
    }
  } catch (error) {
    console.warn("Failed to delete old image:", error.message);
  }
};

// Routes
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Art Portfolio API</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px; 
            background-color: #f8f9fa;
            color: #333;
          }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
          h2 { margin-top: 40px; color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-bottom: 20px; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #3498db; color: white; font-weight: 600; }
          code { 
            background: #ecf0f1; 
            padding: 3px 6px; 
            border-radius: 4px;
            font-family: 'Courier New', monospace;
          }
          .method { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            color: white; 
            font-weight: bold;
          }
          .get { background-color: #27ae60; }
          .post { background-color: #2980b9; }
          .put { background-color: #f39c12; }
          .delete { background-color: #e74c3c; }
          .status-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎨 Art Portfolio API Documentation</h1>
          <p style="text-align: center; font-size: 18px; color: #7f8c8d;">
            RESTful API untuk mengelola portfolio karya seni
          </p>

          <h2>🔍 Mengambil Semua Karya</h2>
          <table>
            <tr><th>Method</th><td><span class="method get">GET</span></td></tr>
            <tr><th>URL</th><td><code>/artworks</code></td></tr>
            <tr><th>Query Parameters</th><td>
              <code>page</code> (optional): Halaman (default: 1)<br/>
              <code>limit</code> (optional): Jumlah per halaman (default: 10)<br/>
              <code>status</code> (optional): Filter berdasarkan status (0 atau 1)
            </td></tr>
            <tr><th>Response</th><td>JSONArray berisi karya seni dengan metadata pagination</td></tr>
          </table>

          <h2>🔍 Mengambil Karya Berdasarkan ID</h2>
          <table>
            <tr><th>Method</th><td><span class="method get">GET</span></td></tr>
            <tr><th>URL</th><td><code>/artworks/:id</code></td></tr>
            <tr><th>Response</th><td>JSONObject dari karya yang diminta</td></tr>
          </table>

          <h2>➕ Menyimpan Karya Baru</h2>
          <table>
            <tr><th>Method</th><td><span class="method post">POST</span></td></tr>
            <tr><th>URL</th><td><code>/artworks</code></td></tr>
            <tr><th>Content-Type</th><td>multipart/form-data</td></tr>
            <tr><th>Request Body</th>
              <td>
                <code>title</code> (required): Judul karya<br/>
                <code>description</code> (required): Deskripsi karya<br/>
                <code>category</code> (required): Kategori karya<br/>
                <code>origin</code> (required): Asal karya<br/>
                <code>artist</code> (required): Nama artist<br/>
                <code>createdDate</code> (required): Tanggal pembuatan<br/>
                <code>status</code> (required): Status karya (0 atau 1)<br/>
                <code>image</code> (required): File gambar (max 5MB)
              </td>
            </tr>
            <tr><th>Response</th><td>JSONObject dari karya yang disimpan</td></tr>
          </table>

          <h2>✏️ Memperbarui Karya</h2>
          <table>
            <tr><th>Method</th><td><span class="method put">PUT</span></td></tr>
            <tr><th>URL</th><td><code>/artworks/:id</code></td></tr>
            <tr><th>Content-Type</th><td>multipart/form-data</td></tr>
            <tr><th>Request Body</th><td>Form-data seperti POST (image optional)</td></tr>
            <tr><th>Response</th><td>JSONObject hasil update</td></tr>
          </table>

          <h2>🗑️ Menghapus Karya</h2>
          <table>
            <tr><th>Method</th><td><span class="method delete">DELETE</span></td></tr>
            <tr><th>URL</th><td><code>/artworks/:id</code></td></tr>
            <tr><th>Response</th><td>{ "message": "Artwork deleted successfully" }</td></tr>
          </table>

          <h2>📂 Mengakses Gambar</h2>
          <table>
            <tr><th>Method</th><td><span class="method get">GET</span></td></tr>
            <tr><th>URL</th><td><code>/uploads/:filename</code></td></tr>
            <tr><th>Response</th><td>File gambar dalam format yang sesuai</td></tr>
          </table>

          <div class="status-info">
            <strong>Status Field:</strong> 
            <ul>
              <li><code>0</code> = Tidak Aktif/Draft</li>
              <li><code>1</code> = Aktif/Published</li>
            </ul>
          </div>

          <div style="margin-top: 40px; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3>📝 Catatan Penting:</h3>
            <ul>
              <li>Semua field yang bertanda (required) wajib diisi</li>
              <li>File gambar maksimal 5MB dengan format JPEG, PNG, atau GIF</li>
              <li>Tanggal harus dalam format yang valid (ISO 8601 recommended)</li>
              <li>Status harus berupa angka 0 atau 1</li>
              <li>Origin dapat berupa nama negara, kota, atau daerah asal karya</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get(
  "/artworks",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status;

    let allArtworks = await ArtworkService.readData();

    // Filter by status if provided
    if (statusFilter !== undefined && [0, 1, "0", "1"].includes(statusFilter)) {
      allArtworks = allArtworks.filter(
        (artwork) => artwork.status == statusFilter
      );
    }

    const total = allArtworks.length;
    const artworks = allArtworks.slice(skip, skip + limit);

    res.json({
      data: artworks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

app.get(
  "/artworks/:id",
  asyncHandler(async (req, res) => {
    const artwork = await ArtworkService.findById(req.params.id);

    if (!artwork) {
      return res.status(404).json({
        error: "Artwork not found",
        message: "Karya seni dengan ID tersebut tidak ditemukan",
      });
    }

    res.json(artwork);
  })
);

app.post(
  "/artworks",
  upload.single("image"),
  validateArtworkData,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Image is required",
        message: "File gambar wajib diupload",
      });
    }

    const {
      title,
      description,
      category,
      origin,
      artist,
      createdDate,
      status,
    } = req.body;
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;

    const artworkData = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      origin: origin.trim(),
      artist: artist.trim(),
      createdDate,
      status: parseInt(status),
      image: imageUrl,
    };

    const newArtwork = await ArtworkService.create(artworkData);
    res.status(201).json(newArtwork);
  })
);

app.put(
  "/artworks/:id",
  upload.single("image"),
  validateArtworkData,
  asyncHandler(async (req, res) => {
    const existingArtwork = await ArtworkService.findById(req.params.id);

    if (!existingArtwork) {
      // Clean up uploaded file if artwork doesn't exist
      if (req.file) {
        await deleteOldImage(`/uploads/${req.file.filename}`);
      }
      return res.status(404).json({
        error: "Artwork not found",
        message: "Karya seni dengan ID tersebut tidak ditemukan",
      });
    }

    const {
      title,
      description,
      category,
      origin,
      artist,
      createdDate,
      status,
    } = req.body;

    let imageUrl = existingArtwork.image;
    if (req.file) {
      // Delete old image
      await deleteOldImage(existingArtwork.image);
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
    }

    const artworkData = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      origin: origin.trim(),
      artist: artist.trim(),
      createdDate,
      status: parseInt(status),
      image: imageUrl,
    };

    const updatedArtwork = await ArtworkService.update(
      req.params.id,
      artworkData
    );
    res.json(updatedArtwork);
  })
);

app.delete(
  "/artworks/:id",
  asyncHandler(async (req, res) => {
    const deletedArtwork = await ArtworkService.delete(req.params.id);

    if (!deletedArtwork) {
      return res.status(404).json({
        error: "Artwork not found",
        message: "Karya seni dengan ID tersebut tidak ditemukan",
      });
    }

    await deleteOldImage(deletedArtwork.image);

    res.json({
      message: "Artwork deleted successfully",
      deletedArtwork,
    });
  })
);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "Ukuran file maksimal 5MB",
      });
    }
    return res.status(400).json({
      error: "Upload error",
      message: error.message,
    });
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      error: "Invalid file type",
      message: "Hanya file JPEG, PNG, dan GIF yang diperbolehkan",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message: "Terjadi kesalahan pada server",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: "Endpoint yang diminta tidak ditemukan",
  });
});

const startServer = async () => {
  try {
    // Ensure uploads directory exists
    await ensureDirectoryExists(UPLOADS_DIR);

    app.listen(PORT, () => {
      console.log(`🎨 Art Portfolio API Server running on port ${PORT}`);
      console.log(`📚 Documentation: http://localhost:${PORT}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/artworks`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

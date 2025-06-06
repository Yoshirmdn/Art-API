import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

const DATA_FILE = "data.json";
const readData = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    return [];
  }
};
const writeData = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.get("/artworks", (req, res) => res.json(readData()));

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Art Portfolio API</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          h2 { margin-top: 40px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #aaa; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          code { background: #eee; padding: 2px 4px; }
        </style>
      </head>
      <body>
        <h1>🎨 Dokumentasi API - Art Portfolio</h1>

        <h2>🔍 Mengambil Semua Karya</h2>
        <table>
          <tr><th>Method</th><td>GET</td></tr>
          <tr><th>URL</th><td>/artworks</td></tr>
          <tr><th>Output</th><td>JSONArray berisi karya seni:<br/>
            <code>id</code>, <code>judul</code>, <code>deskripsi</code>, <code>kategori</code>, <code>image</code>, <code>mine</code>, <code>tanggalPembuatan</code>, <code>alat</code>
          </td></tr>
        </table>

        <h2>🔍 Mengambil Karya Berdasarkan ID</h2>
        <table>
          <tr><th>Method</th><td>GET</td></tr>
          <tr><th>URL</th><td>/artworks/:id</td></tr>
          <tr><th>Output</th><td>JSONObject dari karya yang diminta</td></tr>
        </table>

        <h2>➕ Menyimpan Karya Baru</h2>
        <table>
          <tr><th>Method</th><td>POST</td></tr>
          <tr><th>URL</th><td>/artworks</td></tr>
          <tr><th>Request Body</th>
            <td>Form-data:<br/>
              <code>judul</code>, <code>deskripsi</code>, <code>kategori</code>, <code>mine</code>, <code>tanggalPembuatan</code>, <code>alat</code>, <code>image (file)</code>
            </td>
          </tr>
          <tr><th>Output</th><td>JSONObject dari karya yang disimpan</td></tr>
        </table>

        <h2>✏️ Memperbarui Karya</h2>
        <table>
          <tr><th>Method</th><td>PUT</td></tr>
          <tr><th>URL</th><td>/artworks/:id</td></tr>
          <tr><th>Request Body</th>
            <td>Form-data seperti <strong>POST</strong> (boleh tanpa image)</td>
          </tr>
          <tr><th>Output</th><td>JSONObject hasil update</td></tr>
        </table>

        <h2>🗑️ Menghapus Karya</h2>
        <table>
          <tr><th>Method</th><td>DELETE</td></tr>
          <tr><th>URL</th><td>/artworks/:id</td></tr>
          <tr><th>Output</th><td>{ status: "deleted" }</td></tr>
        </table>

        <h2>📂 Mengakses Gambar</h2>
        <table>
          <tr><th>URL</th><td>/uploads/<i>nama_file.jpg</i></td></tr>
          <tr><th>Output</th><td>Gambar dalam format JPEG/PNG sesuai upload</td></tr>
        </table>
      </body>
    </html>
  `);
});

app.post("/artworks", upload.single("image"), (req, res) => {
  const { judul, deskripsi, kategori, mine, tanggalPembuatan, alat } = req.body;
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  const newItem = {
    id: uuidv4(),
    judul,
    deskripsi,
    kategori,
    image: imageUrl,
    mine: parseInt(mine),
    tanggalPembuatan,
    alat,
  };
  const data = readData();
  data.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

app.put("/artworks/:id", upload.single("image"), (req, res) => {
  let data = readData();
  const index = data.findIndex((i) => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Not found" });

  const oldItem = data[index];

  let imageUrl = oldItem.image;
  if (req.file) {
    const oldPath = path.join(
      __dirname,
      "uploads",
      path.basename(oldItem.image)
    );
    fs.unlink(oldPath, () => {});
    imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
  }

  const { judul, deskripsi, kategori, mine, tanggalPembuatan, alat } = req.body;
  const updatedItem = {
    ...oldItem,
    judul,
    deskripsi,
    kategori,
    image: imageUrl,
    mine: parseInt(mine),
    tanggalPembuatan,
    alat,
  };

  data[index] = updatedItem;
  writeData(data);
  res.json(updatedItem);
});

app.delete("/artworks/:id", (req, res) => {
  let data = readData();
  const item = data.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(__dirname, "uploads", path.basename(item.image));
  fs.unlink(filePath, () => {});
  data = data.filter((i) => i.id !== req.params.id);
  writeData(data);

  res.json({ status: "deleted" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get("/artworks/:id", (req, res) => {
  const data = readData();
  const item = data.find((i) => i.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(item);
});

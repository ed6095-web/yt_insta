const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// 🔥 REQUIRED for Render
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Optional: only needed if serving local frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// ✅ Test route (VERY IMPORTANT)
app.get("/", (req, res) => {
  res.send("Backend running on Render 🚀");
});

// Helper: cookies file
function getCookiesFilePath() {
  const cookiesFilePath = path.join(__dirname, 'cookies.txt');
  if (!fs.existsSync(cookiesFilePath)) return null;
  return cookiesFilePath;
}

// =========================
// GET VIDEO INFO
// =========================
app.post('/get-video-info', (req, res) => {
  const { videoLink } = req.body;

  if (!videoLink) {
    return res.status(400).json({ error: 'Video link required' });
  }

  const cookiesFilePath = getCookiesFilePath();

  let command = cookiesFilePath
    ? `yt-dlp --cookies "${cookiesFilePath}" --dump-json --no-playlist "${videoLink}"`
    : `yt-dlp --dump-json --no-playlist "${videoLink}"`;

  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch video info",
        details: stderr
      });
    }

    try {
      const videoInfo = JSON.parse(stdout);

      const formats = videoInfo.formats.filter(f =>
        f.vcodec !== 'none' && f.url
      );

      res.json({
        success: true,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        uploader: videoInfo.uploader,
        original_url: videoInfo.webpage_url,
        formats
      });

    } catch (e) {
      res.status(500).json({ error: "JSON parse failed" });
    }
  });
});

// =========================
// STREAM VIDEO
// =========================
app.get('/stream-video', (req, res) => {
  const { url, height, ext } = req.query;

  if (!url || !height) {
    return res.status(400).send("Missing parameters");
  }

  const formatSelection =
    `bestvideo[height<=?${height}][ext=mp4]+bestaudio[ext=m4a]/best`;

  const command =
    `yt-dlp -f "${formatSelection}" -o - "${url}" --no-playlist`;

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="video_${height}p.${ext || 'mp4'}"`
  );

  const yt = exec(command, { maxBuffer: 1024 * 1024 * 100 });

  yt.stdout.pipe(res);

  yt.on('close', code => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).send("Download failed");
    }
  });
});

// =========================
// START SERVER
// =========================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

import cors from "cors";   // or require("cors")
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({
  origin: "https://yt-insta.vercel.app"
}));
const port = process.env.PORT || 5000; // The port the server will listen on

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Helper function to get cookies file path and check its existence
function getCookiesFilePath() {
    const cookiesFilePath = path.join(__dirname, 'cookies.txt');
    if (!fs.existsSync(cookiesFilePath)) {
        console.warn(`Warning: cookies.txt not found at ${cookiesFilePath}. Some downloads (e.g., YouTube members-only, private Instagram) may fail.`);
        return null; // Return null if not found, yt-dlp will proceed without it if not needed
    }
    return cookiesFilePath;
}

// Endpoint to get video information and available formats
st('/get-video-info', (req, res) => {
    const { videoLink } = req.body;

    if (!videoLink) {
        console.error('Error: Video link is required for getting info.');
        return res.status(400).json({ error: 'Video link is required.' });
    }

    const cookiesFilePath = getCookiesFilePath();
    // Use --dump-json --flat-playlist to get metadata including formats
    // --no-playlist is important for single video URLs to not treat them as playlists
    let command;
    if (cookiesFilePath) {
        command = `yt-dlp --cookies "${cookiesFilePath}" --dump-json --no-playlist "${videoLink}"`;
    } else {
        command = `yt-dlp --dump-json --no-playlist "${videoLink}"`;
    }

    console.log(`Executing get-video-info command: ${command}`);

    // Increased maxBuffer for potentially large JSON output of video info
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (stderr) {
            console.error(`yt-dlp stderr (get-video-info):\n${stderr}`);
        }

        if (error) {
            console.error(`yt-dlp get-video-info execution error: ${error.message}`);
            let userMessage = `Failed to get video info: ${error.message}`;
            if (stderr.includes("Join this channel to get access to members-only content")) {
                userMessage = "Failed to get info: This is members-only content. Ensure your cookies.txt is valid and your account has an active membership.";
            } else if (stderr.includes("Private video") || stderr.includes("This video is unavailable")) {
                 userMessage = "Failed to get info: The video is private, unavailable, or requires login. Ensure your cookies.txt is valid.";
            } else if (stderr.includes("Instagram") && (stderr.includes("login") || stderr.includes("private"))) {
                userMessage = "Failed to get info: Instagram content might be private or require login. Ensure your cookies.txt is valid for Instagram or the post is public.";
            } else if (stderr.includes("No video formats found")) {
                userMessage = "Failed to get info: No suitable video formats found. The link might be invalid or the content is protected.";
            }
            return res.status(500).json({
                success: false,
                error: userMessage,
                log: stderr.split('\n')
            });
        }

        try {
            const videoInfo = JSON.parse(stdout);

            // Filter for relevant formats: video-only or video+audio, not just audio.
            // Prioritize mp4 where possible for broader compatibility.
            const formats = videoInfo.formats.filter(f =>
                f.vcodec !== 'none' && f.url && (f.ext !== 'mhtml' && f.ext !== 'webp' && f.ext !== 'jpg' && f.ext !== 'png')
            );

            res.json({
                success: true,
                title: videoInfo.title,
                thumbnail: videoInfo.thumbnail,
                uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
                original_url: videoInfo.webpage_url,
                formats: formats, // Send all relevant formats to frontend
                log: stdout.split('\n')
            });
        } catch (parseError) {
            console.error('Error parsing yt-dlp JSON output:', parseError);
            res.status(500).json({
                success: false,
                error: `Failed to parse video info: ${parseError.message}. Raw output might be malformed.`,
                log: stdout.split('\n') // Include raw output for debugging
            });
        }
    });
});


// Endpoint to stream the selected video quality directly to the browser
app.get('/stream-video', (req, res) => {
    const videoUrl = req.query.url;
    const requestedHeight = req.query.height;
    const fileExtension = req.query.ext || 'mp4'; // Default to mp4 if ext not provided

    if (!videoUrl || !requestedHeight) {
        return res.status(400).send('Video URL and requested height are required.');
    }

    const cookiesFilePath = getCookiesFilePath();

    // Construct the yt-dlp command to stream the video to stdout
    // -f: format selection.
    // "bestvideo[height<=?${requestedHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=?${requestedHeight}][ext=mp4]/best":
    // This tries to get the best video format up to the requested height (MP4) and combine it with best audio (M4A).
    // If that fails, it falls back to just the overall best MP4 format up to that height.
    // -o -: output to stdout (pipe directly to response)
    // --no-playlist: ensures single video download even if URL is part of a playlist
    const formatSelection = `bestvideo[height<=?${requestedHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=?${requestedHeight}][ext=mp4]/best`;
    let command;
    if (cookiesFilePath) {
        command = `yt-dlp -f "${formatSelection}" --cookies "${cookiesFilePath}" -o - "${videoUrl}" --no-playlist`;
    } else {
        command = `yt-dlp -f "${formatSelection}" -o - "${videoUrl}" --no-playlist`;
    }

    console.log(`Executing stream command: ${command}`);

    // Set appropriate headers for direct download
    // Content-Disposition: 'attachment' forces browser to download
    // filename: Uses the original title (if known) and selected extension
    // Content-Type: Based on the selected extension
    res.setHeader('Content-Disposition', `attachment; filename="video_download_${requestedHeight}p.${fileExtension}"`);
    res.setHeader('Content-Type', `video/${fileExtension}`); // Generic video type, or more specific if known

    const ytDlpProcess = exec(command, { maxBuffer: 1024 * 1024 * 100 }); // Increased maxBuffer for streaming large files

    // Pipe yt-dlp's stdout directly to the HTTP response
    ytDlpProcess.stdout.pipe(res);

    ytDlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr (stream): ${data.toString()}`);
        // Log stderr, but don't send error response if headers are already sent
        // The browser might already be receiving partial data
    });

    ytDlpProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp stream process exited with code ${code} for URL: ${videoUrl}`);
            // If response hasn't been ended by stdout pipe, end it with an error
            if (!res.headersSent) {
                res.status(500).send(`Failed to stream video. yt-dlp exited with code ${code}. Check server logs for details.`);
            }
        } else {
            console.log(`yt-dlp stream process completed successfully for ${videoUrl}`);
        }
    });

    ytDlpProcess.on('error', (err) => {
        console.error(`Failed tapp.poo start yt-dlp stream process: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).send(`Server error: Could not start download process. ${err.message}`);
        }
    });
});


// Start the Express server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Open your browser and navigate to http://localhost:${port}`);
    console.log('Remember to place your cookies.txt file in the project root (optional for public content) and ensure yt-dlp is installed globally.');
});


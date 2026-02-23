document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const infoForm = document.getElementById('infoForm');
    const videoLinkInput = document.getElementById('videoLink');
    const getInfoButton = document.getElementById('getInfoButton');
    const getInfoButtonText = document.getElementById('getInfoButtonText');
    const getInfoLoadingSpinner = document.getElementById('getInfoLoadingSpinner');

    const videoInfoSection = document.getElementById('videoInfoSection');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const videoUploader = document.getElementById('videoUploader');
    const qualityOptionsContainer = document.getElementById('qualityOptions');
    const resetButton = document.getElementById('resetButton');

    const urlTooltip = document.getElementById('urlTooltip');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const toastContainer = document.getElementById('toastContainer');

    // Store video info globally
    let currentVideoInfo = null;

    // --- Utility Functions ---

    // Show Toast Notification
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type} opacity-0 translate-y-5`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'} mr-2"></i>
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('opacity-0');
            toast.classList.add('translate-y-5');
            setTimeout(() => toast.remove(), 300); // Remove after transition
        }, duration);
    }

    // Validate YouTube or Instagram URL
    function isValidVideoUrl(url) {
        // Updated regex to specifically match common YouTube and Instagram video/post URLs
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|)([a-zA-Z0-9_-]{11})([/?&].*)?$|^((https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(channel\/|c\/|user\/|@)([a-zA-Z0-9_-]{1,})([/?&].*)?)$/;
        const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)\/?([/?&].*)?$/;
        return youtubeRegex.test(url) || instagramRegex.test(url);
    }

    // Reset UI to initial state
    function resetUI() {
        infoForm.classList.remove('hidden');
        videoInfoSection.classList.add('hidden');
        videoLinkInput.value = '';
        currentVideoInfo = null;
        qualityOptionsContainer.innerHTML = '';
        showToast('', 'info', 0); // Clear any existing toasts
        videoLinkInput.focus(); // Focus input for new link
    }

    // --- Event Listeners ---

    // Auto-select text on input click
    videoLinkInput.addEventListener('click', () => {
        videoLinkInput.select();
    });

    // Show/hide tooltip on input hover
    videoLinkInput.addEventListener('mouseenter', () => {
        urlTooltip.classList.remove('hidden');
        setTimeout(() => urlTooltip.classList.remove('opacity-0'), 10);
    });
    videoLinkInput.addEventListener('mouseleave', () => {
        urlTooltip.classList.add('opacity-0');
        setTimeout(() => urlTooltip.classList.add('hidden'), 300);
    });

    // Dark Mode Toggle
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Save preference to localStorage
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // Load theme preference on startup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode'); // Default to light if no preference or 'light'
    }

    // Help Modal
    helpButton.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        setTimeout(() => helpModal.classList.add('show'), 10); // Trigger slide-in animation
    });

    closeModalButton.addEventListener('click', () => {
        helpModal.classList.remove('show');
        setTimeout(() => helpModal.classList.add('hidden'), 300); // Hide after animation
    });

    // Close modal if clicking outside content
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.remove('show');
            setTimeout(() => helpModal.classList.add('hidden'), 300);
        }
    });


    // Event listener for "Get Video Info" form submission
    infoForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const videoLink = videoLinkInput.value.trim();

        if (!isValidVideoUrl(videoLink)) {
            showToast('Please enter a valid YouTube or Instagram video link.', 'error');
            return;
        }

        // Reset UI for new info fetch
        showToast('', 'info', 0); // Clear previous toasts
        videoInfoSection.classList.add('hidden');

        // Disable input and button, show loading spinner
        videoLinkInput.disabled = true;
        getInfoButton.disabled = true;
        getInfoButtonText.textContent = 'Fetching Info...';
        getInfoLoadingSpinner.classList.remove('hidden');
        showToast('Fetching video information... This might take a moment.', 'info');

        try {
    const response = await fetch('https://yt-insta.onrender.com/get-video-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoLink })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                currentVideoInfo = data; // Store the fetched video info
                videoThumbnail.src = data.thumbnail || 'https://placehold.co/120x90/cccccc/333333?text=No+Thumb';
                videoThumbnail.onerror = function() { this.onerror=null; this.src='https://placehold.co/120x90/cccccc/333333?text=No+Thumb'; };
                videoTitle.textContent = data.title;
                videoUploader.textContent = data.uploader || 'Unknown Uploader';
                renderQualityOptions(data.formats);

                infoForm.classList.add('hidden');
                videoInfoSection.classList.remove('hidden');
                showToast('Video information fetched. Select a quality to download.', 'success');
            } else {
                showToast(data.error || 'Failed to fetch video information.', 'error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast(`Network error or server unreachable: ${error.message}. Please ensure the backend server is running.`, 'error');
        } finally {
            // Re-enable input and button, hide loading spinner
            videoLinkInput.disabled = false;
            getInfoButton.disabled = false;
            getInfoButtonText.textContent = 'Get Video Info';
            getInfoLoadingSpinner.classList.add('hidden');
        }
    });

    // Function to render quality options
    function renderQualityOptions(formats) {
        qualityOptionsContainer.innerHTML = ''; // Clear previous options

        // Define a mapping for common qualities to their preferred height
        const qualityHeights = {
            '1080p': 1080,
            '720p': 720,
            '480p': 480,
            '360p': 360,
            '240p': 240,
            '144p': 144
        };

        const availableQualities = new Map(); // Map to store best format for each height

        formats.forEach(format => {
            // Only consider video formats with height, URL, and not audio-only
            if (format.height && format.url && format.vcodec !== 'none') {
                const height = format.height;
                // Prioritize formats that are 'best' or have higher bitrate for the same height
                if (!availableQualities.has(height) || format.tbr > availableQualities.get(height).tbr) {
                    availableQualities.set(height, format);
                }
            }
        });

        // Sort heights in descending order and create buttons
        const sortedHeights = Array.from(availableQualities.keys()).sort((a, b) => b - a);

        if (sortedHeights.length === 0) {
            qualityOptionsContainer.innerHTML = '<p class="text-gray-600 dark:text-gray-400 text-center col-span-2">No downloadable video qualities found.</p>';
            return;
        }

        sortedHeights.forEach(height => {
            const format = availableQualities.get(height);
            const button = document.createElement('button');
            button.className = 'quality-button';
            button.innerHTML = `<i class="fas fa-download mr-2"></i> ${height}p (${format.ext || 'mp4'})`;
            button.dataset.height = height; // Store height for backend
            button.dataset.ext = format.ext; // Store extension for backend filename
            button.addEventListener('click', () => initiateDownload(height, format.ext));
            qualityOptionsContainer.appendChild(button);
        });
    }

    // Function to initiate direct download
    async function initiateDownload(height, ext) {
        if (!currentVideoInfo) {
            showToast('No video information available. Please get video info first.', 'error');
            return;
        }

        showToast(`Preparing download for ${currentVideoInfo.title} (${height}p)...`, 'info');

        // Disable all quality buttons to prevent multiple clicks
        document.querySelectorAll('.quality-button').forEach(btn => btn.disabled = true);

        try {
            // Construct the download URL for the backend stream endpoint
            // Pass the original video URL and the selected height/extension
            const downloadUrl = `https://yt-insta.onrender.com/stream-video?url=${encodeURIComponent(currentVideoInfo.original_url)}&height=${encodeURIComponent(height)}&ext=${encodeURIComponent(ext || 'mp4')}`;

            // Directly set window.location.href to trigger browser download
            // The backend will stream the file with appropriate headers
            window.location.href = downloadUrl;

            showToast(`Download of "${currentVideoInfo.title}" started! Check your browser's downloads.`, 'success');
        } catch (error) {
            console.error('Download initiation error:', error);
            showToast(`Failed to start download: ${error.message}`, 'error');
        } finally {
            // Re-enable quality buttons after a short delay (download is in browser now)
            setTimeout(() => {
                document.querySelectorAll('.quality-button').forEach(btn => btn.disabled = false);
            }, 2000); // Re-enable after 2 seconds
        }
    }

    // Event listener for Reset button
    resetButton.addEventListener('click', resetUI);

    // Support keyboard shortcut: Press Enter to trigger get info
    videoLinkInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            getInfoButton.click();
        }
    });
});

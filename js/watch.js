const WATCH_HISTORY_KEY = 'dmovie_watch_history';

let movie = null;
let currentEpIndex = 0;
let mediaPlayer = null;
let hlsInstance = null;

function getMovieKey(m) {
  if (!m) return '';
  return m.slug || String(m.id);
}

function getWatchHistory() {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function getSavedProgress(m, epIndex = null) {
  if (!m) return null;
  const history = getWatchHistory();
  const key = getMovieKey(m);
  const movieProgress = history[key];
  if (!movieProgress) return null;

  if (epIndex !== null && epIndex !== undefined) {
    return (movieProgress.episodes && movieProgress.episodes[epIndex]) || null;
  }
  return movieProgress;
}

function saveWatchProgress(time, duration) {
  if (!movie || !videoEl || isNaN(time) || isNaN(duration) || duration <= 0) return;
  const currentEp = movie.episodes ? movie.episodes[currentEpIndex] : null;
  if (currentEp && currentEp.embed) return;
  try {
    const history = getWatchHistory();
    const key = getMovieKey(movie);
    if (!history[key]) {
      history[key] = {
        lastEpIndex: currentEpIndex,
        updatedAt: Date.now(),
        episodes: {}
      };
    }

    const isNearEnd = time >= (duration - 15) || videoEl.ended;
    const savedTime = isNearEnd ? 0 : Math.floor(time);
    const percentage = duration > 0 ? (savedTime / duration) * 100 : 0;

    if (!history[key].episodes) history[key].episodes = {};
    history[key].lastEpIndex = currentEpIndex;
    history[key].updatedAt = Date.now();
    history[key].episodes[currentEpIndex] = {
      time: savedTime,
      duration: Math.floor(duration),
      percentage: Math.min(100, Math.max(0, percentage)),
      completed: isNearEnd,
      updatedAt: Date.now()
    };

    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Lỗi lưu lịch sử xem:', e);
  }
}

async function loadData() {
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get('slug') || params.get('id');
  const epParam = parseInt(params.get('ep'), 10);

  if (!slugParam) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch('data.json?v=' + Date.now());
    const allMovies = await res.json();
    allMovies.sort((a, b) => (b.id || 0) - (a.id || 0));
    movie = allMovies.find(m => m.slug === slugParam || String(m.id) === String(slugParam));

    if (!movie) {
      window.location.href = 'index.html';
      return;
    }

    let initialEpIndex = 0;
    if (!isNaN(epParam) && epParam > 0) {
      initialEpIndex = epParam - 1;
    } else {
      const saved = getSavedProgress(movie);
      if (saved && typeof saved.lastEpIndex === 'number' && saved.lastEpIndex >= 0 && saved.lastEpIndex < movie.episodes.length) {
        initialEpIndex = saved.lastEpIndex;
      }
    }

    currentEpIndex = Math.max(0, Math.min(initialEpIndex, movie.episodes.length - 1));
    renderPage(allMovies);
    initResumeToastEvents();
    initBackNavigationEvents();
  } catch (e) {
    console.error('Không thể tải dữ liệu:', e);
  }
}

function renderPage(allMovies) {
  document.title = `${movie.title} - DMovie`;

  // Movie info
  document.getElementById('watchTitle').textContent = movie.title;

  const ratingScore = parseFloat(movie.rating) || 8.5;
  const fullStars = Math.min(5, Math.floor(ratingScore / 2));
  let starsHtml = '';
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      starsHtml += `<span class="material-symbols-outlined fill">star</span>`;
    } else {
      starsHtml += `<span class="material-symbols-outlined unfilled">star</span>`;
    }
  }

  document.getElementById('watchMeta').innerHTML = `
    <span class="hero-badge">${movie.genre || 'Hành động'}</span>
    <span class="hero-badge">${movie.type}</span>
    <span>${movie.year}</span>
    <span class="hero-stars">
      ${starsHtml}
      <span style="margin-left: 6px; font-weight: 600; color: #fff;">${movie.rating}/10</span>
    </span>
  `;

  document.getElementById('watchDescription').textContent = movie.description;

  // Episode count
  const epCountEl = document.getElementById('epCount');
  if (epCountEl) epCountEl.textContent = `${movie.episodes.length} tập`;

  // Render episode list
  renderEpisodeList();

  // Load player
  loadEpisode(currentEpIndex);
}

function createMovieCard(movie) {
  const isSeries = movie.type === 'Phim bộ' || (movie.episodes && movie.episodes.length > 1);
  const epCount = movie.episodes ? movie.episodes.length : 1;
  const epLabel = isSeries ? `${epCount} tập` : 'Full';

  const saved = getSavedProgress(movie);
  const epIndex = (saved && typeof saved.lastEpIndex === 'number') ? saved.lastEpIndex : 0;
  const epProgress = saved && saved.episodes ? saved.episodes[epIndex] : null;
  const hasProgress = epProgress && epProgress.percentage > 3 && !epProgress.completed;
  const watchUrl = `watch.html?slug=${movie.slug || movie.id}${epIndex > 0 ? `&ep=${epIndex + 1}` : ''}`;

  return `
    <a class="movie-card" href="${watchUrl}">
      <div class="card-poster">
        <img
          src="${movie.poster}"
          alt="${movie.title}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
        />
        <div class="poster-placeholder" style="display:none">
          <span class="material-symbols-outlined" style="font-size:36px;">movie</span>
        </div>
        <div class="card-overlay">
          <div class="play-circle-btn">
            <span class="material-symbols-outlined fill">play_arrow</span>
          </div>
        </div>
        <span class="card-ep-badge ${isSeries ? 'series' : ''}">${epLabel}</span>
        ${hasProgress ? `<div class="card-progress-bar"><div class="card-progress-fill" style="width: ${epProgress.percentage}%"></div></div>` : ''}
      </div>
      <div class="card-details">
        <h3 class="card-title" title="${movie.title}">${movie.title}</h3>
        <div class="card-meta-line">
          <span>${movie.year} • ${epLabel}</span>
          <span>${movie.rating} ★</span>
        </div>
      </div>
    </a>
  `;
}

function renderEpisodeList() {
  const list = document.getElementById('episodeList');
  if (!list || !movie.episodes) return;

  list.innerHTML = movie.episodes.map((ep, i) => {
    const isSingle = movie.episodes.length === 1;
    const label = ep.button || (isSingle && (ep.title === 'Full Movie' || ep.title === 'Full') ? 'Full' : (i + 1));
    const tip = ep.title || `Tập ${ep.button || (i + 1)}`;
    return `
      <button class="ep-btn ${i === currentEpIndex ? 'active' : ''}"
              onclick="loadEpisode(${i}, true, true)"
              title="${tip}">
        ${label}
      </button>
    `;
  }).join('');
}

function loadEpisode(index, shouldScroll = false, autoPlay = false) {
  if (!movie || index < 0 || index >= movie.episodes.length) return;

  // Save current progress before switching episode
  if (videoEl && !isNaN(videoEl.currentTime) && videoEl.currentTime > 2) {
    saveWatchProgress(videoEl.currentTime, videoEl.duration);
  }

  const wasPlaying = videoEl && !videoEl.paused && !videoEl.ended;
  const shouldAutoPlay = autoPlay || wasPlaying;

  currentEpIndex = index;
  const ep = movie.episodes[index];

  // Parse vmos if present
  let vmosM3u8Url = '';
  let vmosEmbedUrl = '';
  if (ep.vmos) {
    const vmosIdMatch = String(ep.vmos).match(/[a-f0-9-]{36}/i);
    const vmosId = vmosIdMatch ? vmosIdMatch[0] : ep.vmos.trim();
    if (vmosId) {
      vmosM3u8Url = `https://v3.streamvsmov.com/stream/${vmosId}/master.m3u8`;
      vmosEmbedUrl = `https://v3.streamvsmov.com/video/${vmosId}`;
    }
  }

  const url = ep.m3u8 || ep.r2 || vmosM3u8Url || ep.url || '';
  const fallbackEmbed = ep.embed || vmosEmbedUrl;
  const subtitles = ep.sub || ep.subtitles || ep.subtitle;

  // Update URL without reload
  const pageUrl = new URL(window.location);
  if (movie.slug) {
    pageUrl.searchParams.set('slug', movie.slug);
    pageUrl.searchParams.delete('id');
  }
  pageUrl.searchParams.set('ep', index + 1);
  history.replaceState(null, '', pageUrl);

  // Check saved progress for this episode
  const savedEp = getSavedProgress(movie, index);
  let resumeTime = 0;
  if (savedEp && savedEp.time > 5 && !savedEp.completed) {
    resumeTime = savedEp.time;
  }

  if (ep.embed && !ep.m3u8 && !ep.r2 && !ep.vmos) {
    // Không lưu thời gian đang xem khi dùng embed thuần và xóa tiến trình cũ nếu có
    try {
      const history = getWatchHistory();
      const key = getMovieKey(movie);
      if (history[key]) {
        history[key].lastEpIndex = index;
        if (history[key].episodes && history[key].episodes[index]) {
          delete history[key].episodes[index];
        }
        history[key].updatedAt = Date.now();
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
      }
    } catch (_) {}

    hideResumeToast();
    setIframePlayer(ep.embed);
  } else if (ep.driveId && !url) {
    // Ưu tiên trình phát video gốc ở mọi kích thước màn hình
    const streamUrl = `https://drive.usercontent.google.com/download?id=${ep.driveId}&export=download&confirm=t`;
    const fallbackUrl = `https://drive.google.com/file/d/${ep.driveId}/preview`;
    setVideoPlayer(streamUrl, fallbackUrl, shouldAutoPlay, resumeTime, subtitles);
  } else if (url.includes('drive.google.com') || url.includes('youtube.com/embed')) {
    setIframePlayer(url);
  } else {
    setVideoPlayer(url, fallbackEmbed, shouldAutoPlay, resumeTime, subtitles);
  }

  // Update now playing
  const isSeries = movie.type === 'Phim bộ' || movie.episodes.length > 1;
  const epTitle = ep.title || (isSeries ? `Tập ${ep.button || (index + 1)}` : 'Full');
  document.getElementById('nowPlayingEp').textContent = epTitle;

  // Update episode list active state
  document.querySelectorAll('.ep-btn').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Update nav buttons
  document.getElementById('prevEpBtn').disabled = index === 0;
  document.getElementById('nextEpBtn').disabled = index === movie.episodes.length - 1;

  // Scroll only the episode list container if needed, never the window
  const list = document.getElementById('episodeList');
  if (list) {
    const activeEl = list.querySelectorAll('.ep-btn')[index];
    if (activeEl) {
      list.scrollTo({
        left: activeEl.offsetLeft - (list.clientWidth / 2) + (activeEl.clientWidth / 2),
        behavior: 'smooth'
      });
    }
  }
}

let videoEl = null;
let controlsTimeout = null;
let isDraggingTimeline = false;
let playerInitialized = false;

function setVideoPlayer(url, fallbackUrl, autoPlay = false, resumeTime = 0, subtitles = null) {
  const wrapper = document.getElementById('playerWrapper');
  let video = document.getElementById('videoPlayer');

  // If previous element was an iframe, replace it with video
  if (!video || video.tagName !== 'VIDEO') {
    const newVideo = document.createElement('video');
    newVideo.id = 'videoPlayer';
    newVideo.setAttribute('playsinline', '');
    newVideo.setAttribute('webkit-playsinline', '');
    newVideo.setAttribute('preload', 'metadata');
    newVideo.setAttribute('crossorigin', 'anonymous');
    if (video) wrapper.replaceChild(newVideo, video);
    else wrapper.prepend(newVideo);
    video = newVideo;
    playerInitialized = false;
  }

  // Clean up previous HLS instance if any
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  videoEl = video;
  wrapper.classList.remove('is-iframe');

  // Configure subtitles tracks & menu
  setupSubtitles(subtitles);

  const loading = document.getElementById('playerLoading');
  if (loading) loading.classList.remove('hidden');

  // Reset timeline UI
  const playedBar = document.getElementById('timelinePlayed');
  const bufferedBar = document.getElementById('timelineBuffered');
  const currentTimeText = document.getElementById('currentTimeText');
  const durationText = document.getElementById('durationText');
  if (playedBar) playedBar.style.width = '0%';
  if (bufferedBar) bufferedBar.style.width = '0%';
  if (currentTimeText) currentTimeText.textContent = resumeTime > 0 ? formatTime(resumeTime) : '00:00';
  if (durationText) durationText.textContent = '00:00';

  if (!playerInitialized) {
    initPlayerEvents();
    playerInitialized = true;
  }

  const currentSpeed = video.playbackRate || 1;

  try {
    video.pause();
  } catch (_) {}

  video.poster = movie.backdrop || movie.poster || '';

  let resumeHandled = false;
  const applyResumeSeek = () => {
    if (resumeHandled || resumeTime <= 5) return;
    resumeHandled = true;
    try {
      if (video.duration && resumeTime >= video.duration - 10) return;
      video.currentTime = resumeTime;
      updateTimelineProgress();
      showResumeToast(resumeTime);
    } catch (err) {
      console.warn('Seek resume error:', err);
    }
  };

  const isHls = url.includes('.m3u8');

  if (isHls && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
      maxBufferLength: 20,
      maxMaxBufferLength: 30,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.1,
      highBufferWatchdogPeriod: 1,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      maxFragLookUpTolerance: 0.25,
      startFragPrefetch: true,
      progressive: true,
      autoStartLoad: true,
      xhrSetup: function (xhr) {
        xhr.withCredentials = false;
      }
    });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (loading) loading.classList.add('hidden');
      updateDuration();
      applyResumeSeek();
      if (autoPlay) {
        video.play().catch(err => {
          console.warn('Autoplay prevented:', err);
          updatePlayPauseState(false);
        });
      }
    });
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error('HLS fatal error:', data);
        if (loading) loading.classList.add('hidden');
        if (fallbackUrl) {
          setIframePlayer(fallbackUrl);
        } else if (movie && movie.episodes && movie.episodes[currentEpIndex]) {
          const currentEp = movie.episodes[currentEpIndex];
          const embedLink = currentEp.embed || currentEp._embed;
          if (embedLink) {
            console.log('Falling back to embed player:', embedLink);
            setIframePlayer(embedLink);
          }
        }
      }
    });
  } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS Native HLS
    if (video.src !== url) {
      video.src = url;
    }
  } else {
    // Standard MP4 direct stream
    if (video.src !== url) {
      video.src = url;
      video.load();
    }
  }

  video.playbackRate = currentSpeed;

  video.onloadedmetadata = () => {
    if (loading) loading.classList.add('hidden');
    updateDuration();
    applyResumeSeek();
    if (autoPlay && !isHls) {
      const p = video.play();
      if (p !== undefined) {
        p.catch(err => {
          console.warn('Autoplay prevented:', err);
          updatePlayPauseState(false);
        });
      }
    }
  };

  video.oncanplay = () => {
    if (loading) loading.classList.add('hidden');
    if (resumeTime > 5 && !resumeHandled) {
      applyResumeSeek();
    }
  };

  video.onwaiting = () => {
    if (loading) loading.classList.remove('hidden');
  };

  video.onseeking = () => {
    if (loading) loading.classList.remove('hidden');
  };

  video.onseeked = () => {
    if (loading) loading.classList.add('hidden');
  };

  video.onplaying = () => {
    if (loading) loading.classList.add('hidden');
    updatePlayPauseState(true);
  };

  video.onerror = () => {
    if (loading) loading.classList.add('hidden');
    if (fallbackUrl) {
      setIframePlayer(fallbackUrl);
    } else if (movie && movie.episodes && movie.episodes[currentEpIndex]) {
      const currentEp = movie.episodes[currentEpIndex];
      const embedLink = currentEp.embed || currentEp._embed;
      if (embedLink) {
        setIframePlayer(embedLink);
      }
    }
  };
}

function setIframePlayer(url) {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  videoEl = null;
  const wrapper = document.getElementById('playerWrapper');
  let player = document.getElementById('videoPlayer');

  if (!player || player.tagName !== 'IFRAME') {
    const iframe = document.createElement('iframe');
    iframe.id = 'videoPlayer';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    if (player) wrapper.replaceChild(iframe, player);
    else wrapper.prepend(iframe);
    player = iframe;
  }

  wrapper.classList.add('is-iframe');
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:1;';
  player.src = url;
  const loading = document.getElementById('playerLoading');
  if (loading) loading.classList.add('hidden');
}

function initPlayerEvents() {
  const wrapper = document.getElementById('playerWrapper');
  const video = videoEl;
  if (!video) return;

  // Play / Pause toggles
  const centerPlayPauseBtn = document.getElementById('centerPlayPauseBtn');
  const ctrlPlayPauseBtn = document.getElementById('ctrlPlayPauseBtn');

  centerPlayPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });

  ctrlPlayPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });

  // Center Seek buttons (5s)
  const centerRewindBtn = document.getElementById('centerRewindBtn');
  const centerForwardBtn = document.getElementById('centerForwardBtn');
  const ctrlRewindBtn = document.getElementById('ctrlRewindBtn');
  const ctrlForwardBtn = document.getElementById('ctrlForwardBtn');

  centerRewindBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    seekBy(-5);
  });
  centerForwardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    seekBy(5);
  });
  ctrlRewindBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    seekBy(-5);
  });
  ctrlForwardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    seekBy(5);
  });

  let lastProgressSaveTime = 0;

  // Video element events
  video.addEventListener('play', () => {
    updatePlayPauseState(true);
    resetControlsTimeout();
  });

  video.addEventListener('pause', () => {
    updatePlayPauseState(false);
    showControls();
    if (video.currentTime > 2) {
      saveWatchProgress(video.currentTime, video.duration);
    }
  });

  video.addEventListener('timeupdate', () => {
    if (!isDraggingTimeline) {
      updateTimelineProgress();
    }
    const now = Date.now();
    if (now - lastProgressSaveTime > 1500) {
      lastProgressSaveTime = now;
      if (video.currentTime > 2) {
        saveWatchProgress(video.currentTime, video.duration);
      }
    }
  });

  video.addEventListener('progress', updateBufferedProgress);

  video.addEventListener('ended', () => {
    updatePlayPauseState(false);
    showControls();
    if (video.duration) {
      saveWatchProgress(video.duration, video.duration);
    }
    // Auto next episode if available
    if (movie && currentEpIndex < movie.episodes.length - 1) {
      navigateEpisode(1);
    }
  });

  // Screen click & Double tap to seek 5s
  let lastTapTime = 0;
  let singleTapTimeout = null;

  wrapper.addEventListener('click', (e) => {
    // If clicked on controls or buttons, don't trigger wrapper click
    if (e.target.closest('.player-bottom-controls') || e.target.closest('.player-center-controls') || e.target.closest('.speed-dropdown')) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const widthRatio = clickX / rect.width;
    const now = Date.now();

    if (now - lastTapTime < 300) {
      // Double click / Double tap
      clearTimeout(singleTapTimeout);
      if (widthRatio < 0.4) {
        seekBy(-5);
        triggerSeekRipple('left');
      } else if (widthRatio > 0.6) {
        seekBy(5);
        triggerSeekRipple('right');
      } else {
        toggleFullscreen();
      }
    } else {
      // Single click / Single tap
      singleTapTimeout = setTimeout(() => {
        if (wrapper.classList.contains('hide-controls') && !video.paused) {
          showControls();
          resetControlsTimeout();
        } else {
          togglePlay();
        }
      }, 250);
    }
    lastTapTime = now;
  });

  // Hover / Mouse move auto-hide controls
  wrapper.addEventListener('mousemove', () => {
    showControls();
    resetControlsTimeout();
  });

  wrapper.addEventListener('mouseleave', () => {
    if (!video.paused && !isDraggingTimeline) {
      hideControls();
    }
  });

  // Timeline scrubber interactions
  initTimelineEvents();

  // Volume & Slider
  initVolumeEvents();

  // Speed selector
  initSpeedEvents();

  // Subtitles selector
  initSubtitleEvents();

  // PiP & Fullscreen
  initPipAndFullscreenEvents();

  // Keyboard shortcuts
  initKeyboardEvents();
}

function togglePlay() {
  if (!videoEl) return;
  if (videoEl.paused || videoEl.ended) {
    videoEl.play().catch(() => {});
  } else {
    videoEl.pause();
  }
}

function seekBy(seconds) {
  if (!videoEl || isNaN(videoEl.duration)) return;
  videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + seconds));
  updateTimelineProgress();
  triggerSeekRipple(seconds < 0 ? 'left' : 'right');
  showControls();
  resetControlsTimeout();
}

function triggerSeekRipple(direction) {
  const ripple = document.getElementById(direction === 'left' ? 'seekRippleLeft' : 'seekRippleRight');
  if (!ripple) return;
  ripple.classList.remove('active');
  void ripple.offsetWidth; // Force reflow
  ripple.classList.add('active');
  setTimeout(() => ripple.classList.remove('active'), 600);
}

function updatePlayPauseState(isPlaying) {
  const centerBtn = document.getElementById('centerPlayPauseBtn');
  const ctrlBtn = document.getElementById('ctrlPlayPauseBtn');
  const wrapper = document.getElementById('playerWrapper');

  [centerBtn, ctrlBtn].forEach(btn => {
    if (!btn) return;
    const iconPlay = btn.querySelector('.icon-play');
    const iconPause = btn.querySelector('.icon-pause');
    if (isPlaying) {
      if (iconPlay) iconPlay.style.display = 'none';
      if (iconPause) iconPause.style.display = 'block';
    } else {
      if (iconPlay) iconPlay.style.display = 'block';
      if (iconPause) iconPause.style.display = 'none';
    }
  });

  if (wrapper) {
    wrapper.classList.toggle('is-playing', isPlaying);
  }
}

function updateTimelineProgress() {
  if (!videoEl || isNaN(videoEl.duration) || videoEl.duration === 0) return;
  const current = videoEl.currentTime;
  const duration = videoEl.duration;
  const percent = (current / duration) * 100;

  const playedBar = document.getElementById('timelinePlayed');
  const currentTimeText = document.getElementById('currentTimeText');

  if (playedBar) playedBar.style.width = `${percent}%`;
  if (currentTimeText) currentTimeText.textContent = formatTime(current);
}

function updateBufferedProgress() {
  if (!videoEl || !videoEl.buffered || isNaN(videoEl.duration) || videoEl.duration === 0) return;
  const duration = videoEl.duration;
  const buffered = videoEl.buffered;
  const bufferedBar = document.getElementById('timelineBuffered');

  if (bufferedBar && buffered.length > 0) {
    const end = buffered.end(buffered.length - 1);
    bufferedBar.style.width = `${Math.min(100, (end / duration) * 100)}%`;
  }
}

function updateDuration() {
  if (!videoEl || isNaN(videoEl.duration)) return;
  const durationText = document.getElementById('durationText');
  if (durationText) durationText.textContent = formatTime(videoEl.duration);
}

function initTimelineEvents() {
  const container = document.getElementById('timelineContainer');
  const track = document.getElementById('timelineTrack');
  const preview = document.getElementById('timelineHoverPreview');
  const tooltip = document.getElementById('timelineTooltip');

  if (!container || !track) return;

  let isMouseDown = false;

  const updateVisualSeek = (e) => {
    if (!videoEl || isNaN(videoEl.duration) || videoEl.duration === 0) return;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    currentSeekPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = currentSeekPos * videoEl.duration;

    const playedBar = document.getElementById('timelinePlayed');
    const currentTimeText = document.getElementById('currentTimeText');
    if (playedBar) playedBar.style.width = `${currentSeekPos * 100}%`;
    if (currentTimeText) currentTimeText.textContent = formatTime(targetTime);
  };

  const commitSeek = () => {
    if (!videoEl || isNaN(videoEl.duration) || videoEl.duration === 0) return;
    const targetTime = currentSeekPos * videoEl.duration;
    if (typeof videoEl.fastSeek === 'function') {
      videoEl.fastSeek(targetTime);
    } else {
      videoEl.currentTime = targetTime;
    }
    updateTimelineProgress();
  };

  container.addEventListener('click', (e) => {
    updateVisualSeek(e);
    commitSeek();
    showControls();
    resetControlsTimeout();
  });

  container.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    isDraggingTimeline = true;
    updateVisualSeek(e);
    showControls();
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingTimeline) {
      updateVisualSeek(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingTimeline) {
      isDraggingTimeline = false;
      commitSeek();
      resetControlsTimeout();
    }
    isMouseDown = false;
  });

  // Touch scrubbing on mobile
  container.addEventListener('touchstart', (e) => {
    isDraggingTimeline = true;
    updateVisualSeek(e);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isDraggingTimeline) {
      updateVisualSeek(e);
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    if (isDraggingTimeline) {
      isDraggingTimeline = false;
      commitSeek();
      resetControlsTimeout();
    }
  });

  // Hover Preview Tooltip
  container.addEventListener('mousemove', (e) => {
    if (!videoEl || isNaN(videoEl.duration)) return;
    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hoverTime = pos * videoEl.duration;

    if (preview) preview.style.width = `${pos * 100}%`;
    if (tooltip) {
      tooltip.textContent = formatTime(hoverTime);
      const tooltipX = Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left));
      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.opacity = '1';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (preview) preview.style.width = '0%';
    if (tooltip) tooltip.style.opacity = '0';
  });
}

function initVolumeEvents() {
  const volBtn = document.getElementById('ctrlVolumeBtn');
  const slider = document.getElementById('volumeSlider');
  if (!volBtn || !slider) return;

  const updateVolUI = () => {
    if (!videoEl) return;
    slider.value = videoEl.muted ? 0 : videoEl.volume;
    const isMuted = videoEl.muted || videoEl.volume === 0;

    const iconHigh = volBtn.querySelector('.icon-vol-high');
    const iconMute = volBtn.querySelector('.icon-vol-mute');

    if (iconHigh && iconMute) {
      iconHigh.style.display = isMuted ? 'none' : 'block';
      iconMute.style.display = isMuted ? 'block' : 'none';
    }
  };

  volBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted && videoEl.volume === 0) {
      videoEl.volume = 0.5;
    }
    updateVolUI();
  });

  slider.addEventListener('input', (e) => {
    if (!videoEl) return;
    videoEl.volume = parseFloat(e.target.value);
    videoEl.muted = videoEl.volume === 0;
    updateVolUI();
  });
}

function initSpeedEvents() {
  const speedBtn = document.getElementById('ctrlSpeedBtn');
  const dropdown = document.getElementById('speedDropdown');
  if (!speedBtn || !dropdown) return;

  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  dropdown.querySelectorAll('.speed-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const speed = parseFloat(opt.dataset.speed);
      if (videoEl) videoEl.playbackRate = speed;
      speedBtn.textContent = `${speed}x`;
      dropdown.querySelectorAll('.speed-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      dropdown.classList.remove('show');
    });
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });
}

let currentSubtitleIndex = 0;

function updateCustomSubtitleDisplay() {
  const overlay = document.getElementById('customSubtitleOverlay');
  if (!overlay || !videoEl) return;

  if (currentSubtitleIndex < 0 || !videoEl.textTracks || videoEl.textTracks.length === 0) {
    overlay.innerHTML = '';
    return;
  }

  const track = videoEl.textTracks[currentSubtitleIndex];
  if (!track || !track.activeCues || track.activeCues.length === 0) {
    overlay.innerHTML = '';
    return;
  }

  const lines = [];
  for (let i = 0; i < track.activeCues.length; i++) {
    const cue = track.activeCues[i];
    if (cue && cue.text) {
      lines.push(cue.text.replace(/\n/g, '<br/>'));
    }
  }

  if (lines.length > 0) {
    overlay.innerHTML = `<div class="custom-subtitle-text">${lines.join('<br/>')}</div>`;
  } else {
    overlay.innerHTML = '';
  }
}

function setupSubtitles(subtitles) {
  const overlay = document.getElementById('customSubtitleOverlay');
  if (overlay) overlay.innerHTML = '';
  if (!videoEl) return;

  // Clear existing tracks
  while (videoEl.querySelector('track')) {
    videoEl.querySelector('track').remove();
  }

  if (!subtitles || (Array.isArray(subtitles) && subtitles.length === 0)) {
    currentSubtitleIndex = -1;
    return;
  }

  const subList = Array.isArray(subtitles)
    ? subtitles
    : (typeof subtitles === 'string' ? [{ url: subtitles, label: 'Tiếng Việt', lang: 'vi', default: true }] : [subtitles]);

  const validSubs = subList.filter(s => s && s.url);
  if (validSubs.length === 0) {
    currentSubtitleIndex = -1;
    return;
  }

  // Add tracks to video element
  validSubs.forEach((sub, idx) => {
    const track = document.createElement('track');
    track.kind = sub.kind || 'subtitles';
    track.label = sub.label || (sub.code === 'eng' ? 'English' : 'Tiếng Việt');
    track.srclang = sub.lang || sub.code || 'vi';
    track.src = sub.url;
    if (sub.default !== undefined ? sub.default : idx === 0) {
      track.default = true;
    }

    const attachCueListener = () => {
      if (track.track) {
        // 'hidden' allows cuechange and activeCues in JS without showing browser's black box
        track.track.mode = (idx === 0) ? 'hidden' : 'disabled';
        track.track.removeEventListener('cuechange', updateCustomSubtitleDisplay);
        track.track.addEventListener('cuechange', updateCustomSubtitleDisplay);
      }
    };

    track.addEventListener('load', attachCueListener);
    videoEl.appendChild(track);
  });

  currentSubtitleIndex = 0;

  // Ensure tracks are in hidden mode to feed activeCues to custom overlay
  const ensureTracksReady = () => {
    if (videoEl && videoEl.textTracks && videoEl.textTracks.length > 0) {
      for (let i = 0; i < videoEl.textTracks.length; i++) {
        const t = videoEl.textTracks[i];
        t.mode = (i === 0) ? 'hidden' : 'disabled';
        t.removeEventListener('cuechange', updateCustomSubtitleDisplay);
        t.addEventListener('cuechange', updateCustomSubtitleDisplay);
      }
      updateCustomSubtitleDisplay();
    }
  };

  setTimeout(ensureTracksReady, 100);
  setTimeout(ensureTracksReady, 500);
  setTimeout(ensureTracksReady, 1200);

  videoEl.removeEventListener('timeupdate', updateCustomSubtitleDisplay);
  videoEl.addEventListener('timeupdate', updateCustomSubtitleDisplay);
  videoEl.removeEventListener('seeking', updateCustomSubtitleDisplay);
  videoEl.addEventListener('seeking', updateCustomSubtitleDisplay);
}

function selectSubtitleTrack(index) {
  if (!videoEl || !videoEl.textTracks) return;
  const tracks = videoEl.textTracks;
  currentSubtitleIndex = index;

  for (let i = 0; i < tracks.length; i++) {
    tracks[i].mode = (i === index) ? 'hidden' : 'disabled';
  }
  updateCustomSubtitleDisplay();
}

function toggleSubtitles() {
  if (!videoEl || !videoEl.textTracks || videoEl.textTracks.length === 0) return;
  if (currentSubtitleIndex >= 0) {
    selectSubtitleTrack(-1);
  } else {
    selectSubtitleTrack(0);
  }
}

function initSubtitleEvents() {
  // Subtitles auto-display by default
}

function initPipAndFullscreenEvents() {
  const pipBtn = document.getElementById('ctrlPipBtn');
  const fsBtn = document.getElementById('ctrlFullscreenBtn');
  const wrapper = document.getElementById('playerWrapper');

  if (pipBtn) {
    if (!document.pictureInPictureEnabled) {
      pipBtn.style.display = 'none';
    } else {
      pipBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!videoEl) return;
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await videoEl.requestPictureInPicture();
          }
        } catch (_) {}
      });
    }
  }

  if (fsBtn && wrapper) {
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });

    const onFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      wrapper.classList.toggle('is-fullscreen', isFs);
      updateFullscreenIcons(isFs);

      if (isFs) {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } else {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock().catch(() => {});
        }
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
  }
}

function updateFullscreenIcons(isFs) {
  const fsBtn = document.getElementById('ctrlFullscreenBtn');
  if (!fsBtn) return;
  const iconEnter = fsBtn.querySelector('.icon-fs-enter');
  const iconExit = fsBtn.querySelector('.icon-fs-exit');
  if (iconEnter) iconEnter.style.display = isFs ? 'none' : 'block';
  if (iconExit) iconExit.style.display = isFs ? 'block' : 'none';
}

function toggleFullscreen() {
  const wrapper = document.getElementById('playerWrapper');
  const video = videoEl;
  if (!wrapper) return;

  const isFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  if (!isFullscreen) {
    // Bật Native Fullscreen chuẩn của thiết bị
    const requestFs =
      wrapper.requestFullscreen ||
      wrapper.webkitRequestFullscreen ||
      wrapper.webkitRequestFullScreen ||
      wrapper.mozRequestFullScreen ||
      wrapper.msRequestFullscreen;

    if (requestFs) {
      const p = requestFs.call(wrapper);
      if (p && p.then) {
        p.then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {
          if (video && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        });
      }
    } else if (video && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  } else {
    // Thoát Native Fullscreen
    const exitFs =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.webkitCancelFullScreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;

    if (exitFs) {
      exitFs.call(document).catch(() => {});
    }
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock().catch(() => {});
    }
  }
}

function initKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    // Ignore when typing in input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      seekBy(-5);
    } else if (e.code === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      seekBy(5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      if (videoEl) {
        videoEl.volume = Math.min(1, videoEl.volume + 0.1);
        videoEl.muted = false;
        const slider = document.getElementById('volumeSlider');
        if (slider) slider.value = videoEl.volume;
      }
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (videoEl) {
        videoEl.volume = Math.max(0, videoEl.volume - 0.1);
        const slider = document.getElementById('volumeSlider');
        if (slider) slider.value = videoEl.volume;
      }
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      if (videoEl) videoEl.muted = !videoEl.muted;
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      toggleSubtitles();
    }
  });
}

function showControls() {
  const wrapper = document.getElementById('playerWrapper');
  if (wrapper) wrapper.classList.remove('hide-controls');
}

function hideControls() {
  const wrapper = document.getElementById('playerWrapper');
  const speedDropdown = document.getElementById('speedDropdown');
  const subDropdown = document.getElementById('subtitleDropdown');
  if (speedDropdown && speedDropdown.classList.contains('show')) return;
  if (subDropdown && subDropdown.classList.contains('show')) return;
  if (wrapper && videoEl && !videoEl.paused) {
    wrapper.classList.add('hide-controls');
  }
}

function resetControlsTimeout() {
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    if (videoEl && !videoEl.paused && !isDraggingTimeline) {
      hideControls();
    }
  }, 2600);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const sec = Math.floor(seconds % 60);
  const min = Math.floor((seconds / 60) % 60);
  const hrs = Math.floor(seconds / 3600);

  const pad = (n) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}`;
}

function navigateEpisode(direction) {
  const newIndex = currentEpIndex + direction;
  if (newIndex >= 0 && newIndex < movie.episodes.length) {
    loadEpisode(newIndex, true, true);
  }
}

let resumeToastTimer = null;

function showResumeToast(timeInSeconds) {
  const toast = document.getElementById('playerResumeToast');
  const text = document.getElementById('resumeToastText');
  if (!toast || !text) return;

  text.innerHTML = `Tiếp tục xem từ <strong>${formatTime(timeInSeconds)}</strong>`;
  toast.classList.remove('hidden');

  clearTimeout(resumeToastTimer);
  resumeToastTimer = setTimeout(() => {
    hideResumeToast();
  }, 4500);
}

function hideResumeToast() {
  const toast = document.getElementById('playerResumeToast');
  if (toast) toast.classList.add('hidden');
  clearTimeout(resumeToastTimer);
}

function initResumeToastEvents() {
  const restartBtn = document.getElementById('resumeRestartBtn');
  const closeBtn = document.getElementById('resumeCloseBtn');

  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoEl) {
        videoEl.currentTime = 0;
        saveWatchProgress(0, videoEl.duration);
        updateTimelineProgress();
      }
      hideResumeToast();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideResumeToast();
    });
  }
}

function initBackNavigationEvents() {
  const saveState = () => {
    if (videoEl && !isNaN(videoEl.currentTime) && !isNaN(videoEl.duration) && videoEl.currentTime > 2) {
      saveWatchProgress(videoEl.currentTime, videoEl.duration);
    }
  };

  window.addEventListener('beforeunload', saveState);
  window.addEventListener('pagehide', saveState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveState();
    }
  });

  const backBtn = document.querySelector('.watch-navbar-back');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      saveState();
      if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }
}

loadData();


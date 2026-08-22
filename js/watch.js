let movie = null;
let currentEpIndex = 0;
let mediaPlayer = null;

async function loadData() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));
  const epParam = parseInt(params.get('ep'), 10);
  const epIndex = !isNaN(epParam) && epParam > 0 ? epParam - 1 : 0;

  if (!id) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch('data.json');
    const allMovies = await res.json();
    movie = allMovies.find(m => m.id === id);

    if (!movie) {
      window.location.href = 'index.html';
      return;
    }

    currentEpIndex = Math.max(0, Math.min(epIndex, movie.episodes.length - 1));
    renderPage(allMovies);
  } catch (e) {
    console.error('Không thể tải dữ liệu:', e);
  }
}

function renderPage(allMovies) {
  document.title = `${movie.title} - DMovie`;

  // Breadcrumb
  document.getElementById('breadcrumbTitle').textContent = movie.title;

  // Movie info
  const isSeries = movie.type === 'Phim bộ';
  document.getElementById('watchTitle').textContent = movie.title;

  const typeEl = document.getElementById('watchType');
  typeEl.textContent = movie.type;
  if (isSeries) typeEl.classList.add('series');

  document.getElementById('watchMeta').innerHTML = `
    <span class="meta-tag"><span class="meta-star">★</span> ${movie.rating}/10</span>
    <span class="meta-tag">📅 ${movie.year}</span>
    <span class="meta-tag">🎬 ${movie.genre}</span>
  `;

  document.getElementById('watchDescription').textContent = movie.description;

  // Episode count
  document.getElementById('epCount').textContent = `${movie.episodes.length} tập`;

  // Render episode list
  renderEpisodeList();

  // Load player
  loadEpisode(currentEpIndex);

  // Related movies (same genre or type, exclude current)
  const related = allMovies
    .filter(m => m.id !== movie.id && (m.genre === movie.genre || m.type === movie.type))
    .slice(0, 6);

  const relatedGrid = document.getElementById('relatedGrid');
  if (related.length) {
    relatedGrid.innerHTML = related.map(m => createMovieCard(m)).join('');
  } else {
    document.querySelector('.related-section').style.display = 'none';
  }
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
              onclick="loadEpisode(${i}, true)"
              title="${tip}">
        ${label}
      </button>
    `;
  }).join('');
}

function loadEpisode(index, shouldScroll = false) {
  if (!movie || index < 0 || index >= movie.episodes.length) return;

  currentEpIndex = index;
  const ep = movie.episodes[index];
  const url = ep.r2 || ep.url || '';

  // Update URL without reload
  const pageUrl = new URL(window.location);
  pageUrl.searchParams.set('ep', index + 1);
  history.replaceState(null, '', pageUrl);

  if (ep.driveId && !url) {
    // Ưu tiên trình phát video gốc ở mọi kích thước màn hình. Iframe preview
    // của Google Drive có thể đặt timeline sai vị trí trên mobile.
    const streamUrl = `https://drive.usercontent.google.com/download?id=${ep.driveId}&export=download&confirm=t`;
    const fallbackUrl = `https://drive.google.com/file/d/${ep.driveId}/preview`;
    // Nếu Drive không cho stream trực tiếp, onerror sẽ chuyển sang iframe.
    setVideoPlayer(streamUrl, fallbackUrl);
  } else if (url.includes('drive.google.com') || url.includes('youtube.com/embed')) {
    setIframePlayer(url);
  } else {
    setVideoPlayer(url, null);
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

  const activeEl = document.querySelectorAll('.ep-btn')[index];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });

  if (shouldScroll) window.scrollTo({ top: 64, behavior: 'smooth' });
}

let videoEl = null;
let controlsTimeout = null;
let isDraggingTimeline = false;
let playerInitialized = false;

function setVideoPlayer(url, fallbackUrl) {
  const wrapper = document.getElementById('playerWrapper');
  let video = document.getElementById('videoPlayer');

  // If previous element was an iframe, replace it with video
  if (!video || video.tagName !== 'VIDEO') {
    const newVideo = document.createElement('video');
    newVideo.id = 'videoPlayer';
    newVideo.setAttribute('playsinline', '');
    newVideo.setAttribute('webkit-playsinline', '');
    newVideo.setAttribute('preload', 'metadata');
    if (video) wrapper.replaceChild(newVideo, video);
    else wrapper.prepend(newVideo);
    video = newVideo;
  }

  videoEl = video;
  wrapper.classList.remove('is-iframe');

  const loading = document.getElementById('playerLoading');
  loading.classList.remove('hidden');

  video.poster = movie.backdrop || movie.poster;
  video.src = url;

  if (!playerInitialized) {
    initPlayerEvents();
    playerInitialized = true;
  }

  video.onloadedmetadata = () => {
    loading.classList.add('hidden');
    updateDuration();
  };

  video.oncanplay = () => {
    loading.classList.add('hidden');
  };

  video.onwaiting = () => {
    loading.classList.remove('hidden');
  };

  video.onplaying = () => {
    loading.classList.add('hidden');
  };

  video.onerror = () => {
    loading.classList.add('hidden');
    if (fallbackUrl) {
      setIframePlayer(fallbackUrl);
    }
  };

  video.load();
}

function setIframePlayer(url) {
  const wrapper = document.getElementById('playerWrapper');
  let player = document.getElementById('videoPlayer');

  if (!player || player.tagName !== 'IFRAME') {
    const iframe = document.createElement('iframe');
    iframe.id = 'videoPlayer';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
    if (player) wrapper.replaceChild(iframe, player);
    else wrapper.prepend(iframe);
    player = iframe;
  }

  wrapper.classList.add('is-iframe');
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:1;';
  player.src = url;
  document.getElementById('playerLoading').classList.add('hidden');
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

  // Video element events
  video.addEventListener('play', () => {
    updatePlayPauseState(true);
    resetControlsTimeout();
  });

  video.addEventListener('pause', () => {
    updatePlayPauseState(false);
    showControls();
  });

  video.addEventListener('timeupdate', () => {
    if (!isDraggingTimeline) {
      updateTimelineProgress();
    }
  });

  video.addEventListener('progress', updateBufferedProgress);

  video.addEventListener('ended', () => {
    updatePlayPauseState(false);
    showControls();
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

  const handleSeek = (e) => {
    if (!videoEl || isNaN(videoEl.duration)) return;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    videoEl.currentTime = pos * videoEl.duration;
    updateTimelineProgress();
  };

  container.addEventListener('mousedown', (e) => {
    isDraggingTimeline = true;
    handleSeek(e);
    showControls();
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingTimeline) {
      handleSeek(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingTimeline) {
      isDraggingTimeline = false;
      resetControlsTimeout();
    }
  });

  // Touch scrubbing on mobile
  container.addEventListener('touchstart', (e) => {
    isDraggingTimeline = true;
    handleSeek(e);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isDraggingTimeline) {
      handleSeek(e);
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    isDraggingTimeline = false;
    resetControlsTimeout();
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

    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      wrapper.classList.toggle('is-fullscreen', isFs);
      updateFullscreenIcons(isFs);
    });
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

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 820 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
}

function toggleFullscreen() {
  const wrapper = document.getElementById('playerWrapper');
  if (!wrapper) return;

  if (isMobileDevice()) {
    // Trên mobile: Sử dụng In-Page Fullscreen thuần CSS để Chrome không hiện popup hướng dẫn "Vuốt từ trên xuống để thoát"
    const isMobileFs = wrapper.classList.contains('is-mobile-fullscreen');
    if (!isMobileFs) {
      wrapper.classList.add('is-mobile-fullscreen');
      document.body.classList.add('has-mobile-fullscreen');
      updateFullscreenIcons(true);
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      wrapper.classList.remove('is-mobile-fullscreen');
      document.body.classList.remove('has-mobile-fullscreen');
      updateFullscreenIcons(false);
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock().catch(() => {});
      }
    }
  } else {
    // Trên máy tính: Dùng Fullscreen API chuẩn
    if (!document.fullscreenElement) {
      if (wrapper.requestFullscreen) wrapper.requestFullscreen();
      else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
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
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === 'm') {
      e.preventDefault();
      if (videoEl) videoEl.muted = !videoEl.muted;
    }
  });
}

function showControls() {
  const wrapper = document.getElementById('playerWrapper');
  if (wrapper) wrapper.classList.remove('hide-controls');
}

function hideControls() {
  const wrapper = document.getElementById('playerWrapper');
  const dropdown = document.getElementById('speedDropdown');
  if (dropdown && dropdown.classList.contains('show')) return;
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
    loadEpisode(newIndex, true);
  }
}

function createMovieCard(m) {
  const isSeries = m.type === 'Phim bộ';
  const epLabel = isSeries ? `${m.episodes.length} tập` : 'Full';

  return `
    <div class="movie-card" onclick="window.location.href='watch.html?id=${m.id}'">
      <div class="card-poster">
        <img
          src="${m.poster}"
          alt="${m.title}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
        />
        <div class="poster-placeholder" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="2" width="20" height="20" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <span>${m.title}</span>
        </div>
        <div class="card-overlay">
          <div class="play-btn">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
        <span class="card-type-badge ${isSeries ? 'series' : ''}">${isSeries ? 'Bộ' : 'Lẻ'}</span>
        <span class="card-ep-badge">${epLabel}</span>
      </div>
      <div class="card-body">
        <div class="card-title" title="${m.title}">${m.title}</div>
        <div class="card-meta">
          <span class="card-year">${m.year}</span>
          <span class="card-rating">
            <svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            ${m.rating}
          </span>
        </div>
        <div class="card-genre">${m.genre}</div>
      </div>
    </div>
  `;
}

loadData();

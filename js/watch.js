let movie = null;
let currentEpIndex = 0;
let mediaPlayer = null;

async function loadData() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));
  const ep = parseInt(params.get('ep')) || 0;

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

    currentEpIndex = Math.max(0, Math.min(ep, movie.episodes.length - 1));
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
  list.innerHTML = movie.episodes.map((ep, i) => `
    <div class="episode-item ${i === currentEpIndex ? 'active' : ''}"
          onclick="loadEpisode(${i}, true)">
      <div class="ep-number">${i + 1}</div>
      <div class="ep-title">${ep.title}</div>
      <svg class="ep-play-icon" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    </div>
  `).join('');
}

function loadEpisode(index, shouldScroll = false) {
  if (!movie || index < 0 || index >= movie.episodes.length) return;

  currentEpIndex = index;
  const ep = movie.episodes[index];
  const url = ep.r2 || ep.url || '';

  // Update URL without reload
  const pageUrl = new URL(window.location);
  pageUrl.searchParams.set('ep', index);
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
  document.getElementById('nowPlayingEp').textContent = ep.title;

  // Update episode list active state
  document.querySelectorAll('.episode-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Update nav buttons
  document.getElementById('prevEpBtn').disabled = index === 0;
  document.getElementById('nextEpBtn').disabled = index === movie.episodes.length - 1;

  const activeEl = document.querySelectorAll('.episode-item')[index];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  if (shouldScroll) window.scrollTo({ top: 64, behavior: 'smooth' });
}

function setVideoPlayer(url, fallbackUrl) {
  const wrapper = document.querySelector('.player-wrapper');
  let player = document.getElementById('videoPlayer');

  if (mediaPlayer && !mediaPlayer.isDisposed()) {
    loadVideoSource(url, fallbackUrl);
    return;
  }

  if (!player || player.tagName !== 'VIDEO') {
    const video = document.createElement('video');
    video.id = 'videoPlayer';
    video.className = 'video-js vjs-big-play-centered';
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    if (player) wrapper.replaceChild(video, player);
    else wrapper.appendChild(video);
    player = video;
  }

  mediaPlayer = window.videojs(player, {
    controls: true,
    fluid: true,
    aspectRatio: '16:9',
    controlBar: {
      skipButtons: { backward: 10, forward: 10 },
      volumePanel: { inline: false },
      children: [
        'playToggle', 'skipBackward', 'skipForward', 'volumePanel',
        'currentTimeDisplay', 'timeDivider', 'durationDisplay',
        'progressControl', 'playbackRateMenuButton', 'fullscreenToggle'
      ]
    }
  });
  loadVideoSource(url, fallbackUrl);
}

function loadVideoSource(url, fallbackUrl) {
  const loading = document.getElementById('playerLoading');
  loading.classList.remove('hidden');
  mediaPlayer.one('loadeddata', () => loading.classList.add('hidden'));
  mediaPlayer.one('error', () => {
    loading.classList.add('hidden');
    if (fallbackUrl) setIframePlayer(fallbackUrl);
  });
  mediaPlayer.src({ src: url, type: 'video/mp4' });
  mediaPlayer.load();
}

function setIframePlayer(url) {
  const wrapper = document.querySelector('.player-wrapper');
  let player = document.getElementById('videoPlayer');

  if (mediaPlayer && !mediaPlayer.isDisposed()) {
    mediaPlayer.dispose();
    mediaPlayer = null;
    player = null;
  }

  if (!player || player.tagName !== 'IFRAME') {
    const iframe = document.createElement('iframe');
    iframe.id = 'videoPlayer';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
    if (player) wrapper.replaceChild(iframe, player);
    else wrapper.appendChild(iframe);
    player = iframe;
  }

  // Khôi phục lại 100% gốc không dùng scale hay zoom vì Google Drive
  // dùng getBoundingClientRect() bên trong, nếu bóp méo sẽ làm thanh timeline nhảy lên trên cùng và hỏng cảm ứng.
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:1;';
  player.src = url;
  document.getElementById('playerLoading').classList.add('hidden');
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

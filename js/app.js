let allMovies = [];
let currentFilter = 'all';

// Navbar scroll blur effect
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('topNavbar');
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

async function loadMovies() {
  try {
    const res = await fetch('data.json');
    allMovies = await res.json();
    initHero();
    renderMovies(allMovies);
    handleURLParams();
  } catch (e) {
    console.error('Không thể tải dữ liệu phim:', e);
  }
}

function initHero() {
  if (!allMovies.length) return;
  const featured = allMovies[Math.floor(Math.random() * allMovies.length)];

  // Background Image
  const heroBg = document.getElementById('heroBg');
  if (heroBg) {
    heroBg.style.backgroundImage = `url('${featured.backdrop || featured.poster}')`;
  }

  // Title
  document.getElementById('heroTitle').textContent = featured.title;
  
  // Description
  document.getElementById('heroDesc').textContent = featured.description;

  // Metadata: badges, year, stars
  const ratingScore = parseFloat(featured.rating) || 8.5;
  const fullStars = Math.min(5, Math.floor(ratingScore / 2));
  let starsHtml = '';
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      starsHtml += `<span class="material-symbols-outlined fill">star</span>`;
    } else {
      starsHtml += `<span class="material-symbols-outlined unfilled">star</span>`;
    }
  }

  const isSeries = featured.type === 'Phim bộ' || (featured.episodes && featured.episodes.length > 1);
  const epCount = featured.episodes ? featured.episodes.length : 1;
  const epLabel = isSeries ? `${epCount} tập` : 'Full';

  document.getElementById('heroMeta').innerHTML = `
    <span class="hero-badge">${featured.genre || 'Hành động'}</span>
    <span class="hero-badge">${featured.type}</span>
    <span class="hero-badge">${epLabel}</span>
    <span>${featured.year}</span>
    <span class="hero-stars">
      ${starsHtml}
      <span style="margin-left: 6px; font-weight: 600; color: #fff;">${featured.rating}</span>
    </span>
  `;

  // Watch button URL
  const watchURL = `watch.html?id=${featured.id}`;
  document.getElementById('heroWatch').href = watchURL;
}

function renderMovies(movies) {
  const container = document.getElementById('sectionsContainer');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('movieCount');

  if (count) {
    count.textContent = `${movies.length} phim`;
  }

  if (!movies.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  if (currentFilter === 'all') {
    const singleMovies = movies.filter(m => m.type === 'Phim lẻ');
    const seriesMovies = movies.filter(m => m.type === 'Phim bộ');
    const otherMovies = movies.filter(m => m.type !== 'Phim lẻ' && m.type !== 'Phim bộ');

    let html = '';

    // Line 1: Phim lẻ (nếu có)
    if (singleMovies.length > 0) {
      html += `
        <section class="movie-section">
          <div class="section-header">
            <div class="section-indicator"></div>
            <h2 class="section-title">Phim lẻ</h2>
          </div>
          <div class="movie-grid">
            ${singleMovies.map(m => createMovieCard(m)).join('')}
          </div>
        </section>
      `;
    }

    // Line 2: Phim bộ (nếu có)
    if (seriesMovies.length > 0) {
      html += `
        <section class="movie-section">
          <div class="section-header">
            <div class="section-indicator"></div>
            <h2 class="section-title">Phim bộ</h2>
          </div>
          <div class="movie-grid">
            ${seriesMovies.map(m => createMovieCard(m)).join('')}
          </div>
        </section>
      `;
    }

    // Line phụ nếu có thể loại khác
    if (otherMovies.length > 0) {
      html += `
        <section class="movie-section">
          <div class="section-header">
            <div class="section-indicator"></div>
            <h2 class="section-title">Phim khác</h2>
          </div>
          <div class="movie-grid">
            ${otherMovies.map(m => createMovieCard(m)).join('')}
          </div>
        </section>
      `;
    }

    container.innerHTML = html;
  } else {
    // Khi đang chọn filter riêng hoặc tìm kiếm
    container.innerHTML = `
      <section class="movie-section">
        <div class="section-header">
          <div class="section-indicator"></div>
          <h2 class="section-title">${currentFilter}</h2>
        </div>
        <div class="movie-grid">
          ${movies.map(m => createMovieCard(m)).join('')}
        </div>
      </section>
    `;
  }
}

function createMovieCard(movie) {
  const isSeries = movie.type === 'Phim bộ' || (movie.episodes && movie.episodes.length > 1);
  const epCount = movie.episodes ? movie.episodes.length : 1;
  const epLabel = isSeries ? `${epCount} tập` : 'Full';

  return `
    <a class="movie-card" href="watch.html?id=${movie.id}">
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

function handleURLParams() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (type) {
    setFilter(type);
  }
}

function setFilter(type) {
  currentFilter = type;

  if (type === 'all') {
    renderMovies(allMovies);
  } else {
    renderMovies(allMovies.filter(m => m.type === type));
  }
}

// ===== SEARCH OVERLAY CONTROLS =====
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
const searchToggle = document.getElementById('searchToggle');
const searchClose = document.getElementById('searchClose');

function openSearch() {
  if (!searchOverlay) return;
  searchOverlay.classList.add('open');
  setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  if (!searchOverlay) return;
  searchOverlay.classList.remove('open');
  searchInput.value = '';
}

if (searchToggle) searchToggle.addEventListener('click', openSearch);
if (searchClose) searchClose.addEventListener('click', closeSearch);

if (searchOverlay) {
  searchOverlay.addEventListener('click', e => {
    if (e.target === searchOverlay) closeSearch();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSearch();
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
    if (searchOverlay && !searchOverlay.classList.contains('open') && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      openSearch();
    }
  }
});

if (searchInput) {
  searchInput.addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      setFilter('all');
      return;
    }
    const filtered = allMovies.filter(m =>
      m.title.toLowerCase().includes(query) ||
      (m.genre && m.genre.toLowerCase().includes(query)) ||
      (m.type && m.type.toLowerCase().includes(query))
    );
    currentFilter = `Kết quả: "${e.target.value.trim()}"`;
    renderMovies(filtered);
  });
}

loadMovies();

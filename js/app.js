let allMovies = [];
let currentFilter = 'all';
let currentHeroIndex = 0;
let heroTimer = null;

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
    const res = await fetch('data.json?v=' + Date.now());
    allMovies = await res.json();
    // Sắp xếp danh sách phim theo ID giảm dần (phim mới nhất lên đầu)
    allMovies.sort((a, b) => (b.id || 0) - (a.id || 0));
    initHeroCarousel();
    renderMovies(allMovies);
    handleURLParams();
  } catch (e) {
    console.error('Không thể tải dữ liệu phim:', e);
  }
}

// ===== HERO CAROUSEL SYSTEM =====
function initHeroCarousel() {
  if (!allMovies.length) return;

  renderHeroSlide(0);
  renderHeroPagination();
  startHeroAutoSlide();
}

function renderHeroSlide(index) {
  if (!allMovies.length) return;
  currentHeroIndex = (index + allMovies.length) % allMovies.length;
  const movie = allMovies[currentHeroIndex];

  // Background Image
  const heroBg = document.getElementById('heroBg');
  if (heroBg) {
    heroBg.style.backgroundImage = `url('${movie.backdrop || movie.poster}')`;
  }

  // Title & Description
  document.getElementById('heroTitle').textContent = movie.title;
  document.getElementById('heroDesc').textContent = movie.description;

  // Metadata: badges, year, stars
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

  const isSeries = movie.type === 'Phim bộ' || (movie.episodes && movie.episodes.length > 1);
  const epCount = movie.episodes ? movie.episodes.length : 1;
  const epLabel = isSeries ? `${epCount} tập` : 'Full';

  document.getElementById('heroMeta').innerHTML = `
    <span class="hero-badge">${movie.genre || 'Hành động'}</span>
    <span class="hero-badge">${movie.type}</span>
    <span class="hero-badge">${epLabel}</span>
    <span>${movie.year}</span>
    <span class="hero-stars">
      ${starsHtml}
      <span style="margin-left: 6px; font-weight: 600; color: #fff;">${movie.rating}</span>
    </span>
  `;

  // Watch button URL
  const watchURL = `watch.html?slug=${movie.slug || movie.id}`;
  document.getElementById('heroWatch').href = watchURL;

  // Update dots
  document.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentHeroIndex);
  });
}

function renderHeroPagination() {
  const container = document.getElementById('heroPagination');
  if (!container) return;

  if (allMovies.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = allMovies.map((_, i) => `
    <div class="hero-dot ${i === currentHeroIndex ? 'active' : ''}" onclick="goToHeroSlide(${i})"></div>
  `).join('');
}

function startHeroAutoSlide() {
  if (heroTimer) clearInterval(heroTimer);
  if (allMovies.length > 1) {
    heroTimer = setInterval(() => {
      renderHeroSlide(currentHeroIndex + 1);
    }, 7000);
  }
}

window.goToHeroSlide = function(index) {
  renderHeroSlide(index);
  startHeroAutoSlide(); // Reset auto timer
};

// ===== CAROUSEL MOVIE ROWS =====
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

    // Line 1: Phim lẻ (dạng Carousel)
    if (singleMovies.length > 0) {
      html += createCarouselSection('Phim lẻ', singleMovies);
    }

    // Line 2: Phim bộ (dạng Carousel)
    if (seriesMovies.length > 0) {
      html += createCarouselSection('Phim bộ', seriesMovies);
    }

    // Line phụ nếu có thể loại khác
    if (otherMovies.length > 0) {
      html += createCarouselSection('Phim khác', otherMovies);
    }

    container.innerHTML = html;
  } else {
    // Khi đang tìm kiếm
    container.innerHTML = createCarouselSection(currentFilter, movies);
  }
}

function createCarouselSection(title, movieList) {
  return `
    <section class="movie-section">
      <div class="section-header-carousel">
        <div class="section-header-left">
          <div class="section-indicator"></div>
          <h2 class="section-title">${title}</h2>
        </div>
        <div class="carousel-nav-arrows">
          <button class="carousel-arrow" onclick="scrollCarousel(this, -1)" title="Lùi">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="carousel-arrow" onclick="scrollCarousel(this, 1)" title="Tiến">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      <div class="carousel-track-wrapper">
        <div class="carousel-track">
          ${movieList.map(m => createMovieCard(m)).join('')}
        </div>
      </div>
    </section>
  `;
}

// Carousel scroll navigation
window.scrollCarousel = function(btn, direction) {
  const section = btn.closest('.movie-section');
  if (!section) return;
  const track = section.querySelector('.carousel-track');
  if (track) {
    const cardWidth = track.querySelector('.movie-card')?.offsetWidth || 220;
    const scrollAmount = (cardWidth + 24) * 2 * direction;
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }
};

function createMovieCard(movie) {
  const isSeries = movie.type === 'Phim bộ' || (movie.episodes && movie.episodes.length > 1);
  const epCount = movie.episodes ? movie.episodes.length : 1;
  const epLabel = isSeries ? `${epCount} tập` : 'Full';

  return `
    <a class="movie-card" href="watch.html?slug=${movie.slug || movie.id}">
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

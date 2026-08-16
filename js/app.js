let allMovies = [];
let currentFilter = 'all';

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

  const banner = document.getElementById('heroBanner');
  banner.style.backgroundImage = `url('${featured.backdrop || featured.poster}')`;
  const heroPoster = document.getElementById('heroPoster');
  heroPoster.src = featured.poster;
  heroPoster.alt = `Poster ${featured.title}`;

  document.getElementById('heroBadge').textContent = featured.type;
  document.getElementById('heroTitle').textContent = featured.title;
  document.getElementById('heroDesc').textContent = featured.description;

  document.getElementById('heroMeta').innerHTML = `
    <span class="meta-tag"><span class="meta-star">★</span> ${featured.rating}</span>
    <span class="meta-tag">📅 ${featured.year}</span>
    <span class="meta-tag">🎬 ${featured.genre}</span>
    <span class="meta-tag">📺 ${featured.episodes.length} ${featured.type === 'Phim bộ' ? 'tập' : 'phim'}</span>
  `;

  const watchURL = `watch.html?id=${featured.id}`;
  document.getElementById('heroWatch').href = watchURL;
  document.getElementById('heroInfo').onclick = () => window.location.href = watchURL;
}

function renderMovies(movies) {
  const grid = document.getElementById('movieGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('movieCount');

  count.textContent = `${movies.length} phim`;

  if (!movies.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = movies.map(m => createMovieCard(m)).join('');
}

function createMovieCard(movie) {
  const isSeries = movie.type === 'Phim bộ';
  const epLabel = isSeries ? `${movie.episodes.length} tập` : 'Full';

  return `
    <div class="movie-card" onclick="window.location.href='watch.html?id=${movie.id}'">
      <div class="card-poster">
        <img
          src="${movie.poster}"
          alt="${movie.title}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
        />
        <div class="poster-placeholder" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="2" width="20" height="20" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <span>${movie.title}</span>
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
        <div class="card-title" title="${movie.title}">${movie.title}</div>
        <div class="card-meta">
          <span class="card-year">${movie.year}</span>
          <span class="card-rating">
            <svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            ${movie.rating}
          </span>
        </div>
        <div class="card-genre">${movie.genre}</div>
      </div>
    </div>
  `;
}

function handleURLParams() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (type) {
    setFilter(type);
    const tab = document.querySelector(`[data-type="${type}"]`);
    if (tab) {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    }
  }
}

function setFilter(type) {
  currentFilter = type;
  const title = document.getElementById('sectionTitle');

  if (type === 'all') {
    title.textContent = 'Tất cả phim';
    renderMovies(allMovies);
  } else {
    title.textContent = type;
    renderMovies(allMovies.filter(m => m.type === type));
  }
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    setFilter(tab.dataset.type);
    // Clear search
    document.getElementById('searchInput').value = '';
  });
});

// Search
document.getElementById('searchInput').addEventListener('input', e => {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    setFilter(currentFilter);
    return;
  }
  const filtered = allMovies.filter(m =>
    m.title.toLowerCase().includes(query) ||
    m.genre.toLowerCase().includes(query) ||
    m.type.toLowerCase().includes(query)
  );
  document.getElementById('sectionTitle').textContent = `Kết quả: "${e.target.value.trim()}"`;
  renderMovies(filtered);
});

loadMovies();

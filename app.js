// Debate Tracker - Main Application
// Loads debates data and renders debate cards

const DATA_PATH = 'data/debates.json';

// Global state
let allDebates = [];
let currentSort = 'trending';
let currentSector = 'all';
let currentQuery = '';

// Sector labels
const SECTOR_LABELS = {
    'Steel': 'Steel',
    'Energy': 'Energy',
    'Tech': 'Tech',
    'EV': 'EV',
    'default': ''
};

// Sorting functions
function sortDebates(debates, sortType) {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sorted = [...debates];

    switch (sortType) {
        case 'trending':
            // Most articles in the past month
            sorted.sort((a, b) => {
                const aDate = new Date(a.last_article_date || 0);
                const bDate = new Date(b.last_article_date || 0);
                const aRecent = aDate >= oneMonthAgo ? a.article_count : 0;
                const bRecent = bDate >= oneMonthAgo ? b.article_count : 0;
                // If both have recent activity, sort by article count
                if (aRecent > 0 && bRecent > 0) {
                    return bRecent - aRecent;
                }
                // Recent activity takes priority
                if (aRecent !== bRecent) {
                    return bRecent - aRecent;
                }
                // Fall back to recency
                return bDate - aDate;
            });
            break;

        case 'popular':
            // Most articles all time
            sorted.sort((a, b) => (b.article_count || 0) - (a.article_count || 0));
            break;

        case 'newest':
            // Most recent article date
            sorted.sort((a, b) => {
                const aDate = new Date(a.last_article_date || 0);
                const bDate = new Date(b.last_article_date || 0);
                return bDate - aDate;
            });
            break;

        default:
            break;
    }

    return sorted;
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Get sentiment class
function getSentimentClass(score) {
    if (score === null || score === undefined) return 'neutral';
    if (score > 0.15) return 'positive';
    if (score < -0.15) return 'negative';
    return 'neutral';
}

// Get sentiment label
function getSentimentLabel(score) {
    if (score === null || score === undefined) return 'Mixed';
    if (score > 0.3) return 'Positive';
    if (score > 0.15) return 'Slightly Positive';
    if (score < -0.3) return 'Negative';
    if (score < -0.15) return 'Slightly Negative';
    return 'Neutral';
}

// Create debate card HTML
function createDebateCard(debate) {
    const label = SECTOR_LABELS[debate.sector] || SECTOR_LABELS['default'];
    const sentimentClass = getSentimentClass(debate.avg_sentiment);
    const sentimentLabel = getSentimentLabel(debate.avg_sentiment);

    // Truncate title if too long
    const title = debate.title.length > 100
        ? debate.title.substring(0, 100) + '...'
        : debate.title;

    const sectorBadge = label ? `<span class="category-badge">${label}</span> ` : '';

    // Format last updated as relative time
    const formatLastUpdated = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDate(dateString);
    };

    const lastUpdated = formatLastUpdated(debate.last_updated);

    return `
        <div class="glass-card debate-card" onclick="window.location.href='dashboard.html?id=${debate.id}'">
            <div class="debate-title">${sectorBadge}${title}</div>
            <div class="debate-meta">
                <span>${formatDate(debate.last_article_date)}</span>
                ${lastUpdated ? `<span class="last-updated">Updated ${lastUpdated}</span>` : ''}
            </div>
            ${debate.top_companies && debate.top_companies.length > 0 ? `
                <div style="margin-bottom: 1rem;">
                    <span style="font-size: 0.75rem; color: var(--gray-500);">Companies: </span>
                    <span style="font-size: 0.875rem; color: var(--gray-700);">${debate.top_companies.slice(0, 3).join(', ')}</span>
                </div>
            ` : ''}
            <div class="debate-stats">
                <div class="stat-item">
                    <div class="stat-value">${debate.article_count || 0}</div>
                    <div class="stat-label">Articles</div>
                </div>
                <div class="stat-item">
                    <span class="sentiment-badge sentiment-${sentimentClass}">${sentimentLabel}</span>
                </div>
            </div>
        </div>
    `;
}

// Render debates
function renderDebates(debates) {
    const container = document.getElementById('debatesContainer');

    if (!debates || debates.length === 0) {
        container.innerHTML = `
            <div class="glass-card-static" style="text-align: center; padding: 3rem;">
                <h3>No debates found</h3>
                <p style="color: var(--gray-500); margin-top: 0.5rem;">
                    Run the fetch and export pipeline to generate debates.
                </p>
                <code style="display: block; margin-top: 1rem; padding: 0.5rem; background: var(--gray-100); border-radius: var(--radius-md);">
                    python backend/fetch_articles.py industriestrompreis Energy
                </code>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="debates-grid">
            ${debates.map(debate => createDebateCard(debate)).join('')}
        </div>
    `;
}

// Filter debates by sector
function filterBySector(debates, sector) {
    if (sector === 'all') return debates;
    return debates.filter(d => d.sector === sector);
}

// Search debates by query
function searchDebates(debates, query) {
    if (!query || query.trim() === '') return debates;

    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    return debates.filter(debate => {
        // Build searchable string from debate data
        const searchable = [
            debate.title || '',
            debate.summary || '',
            ...(debate.top_companies || []),
            ...(debate.top_politicians || []),
            ...(debate.top_organizations || []),
            debate.sector || ''
        ].join(' ').toLowerCase();

        // All search terms must be found
        return searchTerms.every(term => searchable.includes(term));
    });
}

// Combined filter, search, and sort
function applyFilters() {
    let filtered = filterBySector(allDebates, currentSector);
    filtered = searchDebates(filtered, currentQuery);
    filtered = sortDebates(filtered, currentSort);
    return filtered;
}

// Re-render with current filters
function updateDisplay() {
    const filtered = applyFilters();
    renderDebates(filtered);
}

// Initialize sector navigation
function initSectorNav() {
    const nav = document.getElementById('sectorNav');
    const tabs = nav.querySelectorAll('.sector-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSector = tab.dataset.sector;
            updateDisplay();
        });
    });
}

// Initialize search with debouncing
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentQuery = searchInput.value;
            updateDisplay();
        }, 150);
    });
}

// Initialize sort controls
function initSortControls() {
    const sortControls = document.getElementById('sortControls');
    if (!sortControls) return;

    const buttons = sortControls.querySelectorAll('.sort-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            updateDisplay();
        });
    });
}

// Load data and initialize
async function init() {
    try {
        const response = await fetch(DATA_PATH);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        allDebates = data.debates || [];

        // Initial render with default sort (trending)
        updateDisplay();

        // Initialize all controls
        initSectorNav();
        initSearch();
        initSortControls();

    } catch (error) {
        console.error('Failed to load debates:', error);

        const container = document.getElementById('debatesContainer');
        container.innerHTML = `
            <div class="glass-card-static" style="text-align: center; padding: 3rem;">
                <h3>No Data Available</h3>
                <p style="color: var(--gray-500); margin-top: 0.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    The data files haven't been generated yet. Run the pipeline to fetch articles and generate the JSON data.
                </p>
                <div style="margin-top: 1.5rem; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto;">
                    <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 0.5rem;">1. Navigate to the backend folder:</p>
                    <code style="display: block; padding: 0.5rem; background: var(--gray-100); border-radius: var(--radius-md); margin-bottom: 1rem;">
                        cd backend
                    </code>
                    <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 0.5rem;">2. Run the pipeline (test mode):</p>
                    <code style="display: block; padding: 0.5rem; background: var(--gray-100); border-radius: var(--radius-md);">
                        python fetch_articles.py industriestrompreis Energy
                    </code>
                </div>
            </div>
        `;
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// Dashboard Page - Event Detail View
// Loads event data and renders charts and metrics

// Global state for filtering
let allQuotes = [];
let allArticles = [];
let currentQuotesFilter = 'all';
let currentArticlesFilter = 'all';
let currentSpeakerFilter = 'all';
let currentSourceFilter = 'all';

// ============================================================================
// UTILITY FUNCTIONS - Centralized to avoid duplication
// ============================================================================

/**
 * Normalize stance values for POLICY POSITIONS (support/oppose the policy)
 * @param {string} stance - Raw stance value from data
 * @returns {string} Normalized stance: 'support', 'oppose', or 'neutral'
 */
function normalizeStance(stance) {
    if (!stance) return 'neutral';
    const s = stance.toLowerCase();
    // Handle both old and new naming
    if (s === 'support' || s === 'positive') return 'support';
    if (s === 'oppose' || s === 'negative') return 'oppose';
    return 'neutral';
}

/**
 * Normalize sentiment values for QUOTES (emotional tone of the quote)
 * @param {string} sentiment - Raw sentiment value from data  
 * @returns {string} Normalized sentiment: 'positive', 'negative', or 'neutral'
 */
function normalizeSentiment(sentiment) {
    if (!sentiment) return 'neutral';
    const s = sentiment.toLowerCase();
    // Map to standard sentiment values
    if (s === 'positive' || s === 'support') return 'positive';
    if (s === 'negative' || s === 'oppose') return 'negative';
    return 'neutral';
}

/**
 * Determine sentiment type from label and score (for articles)
 * @param {string} label - Sentiment label
 * @param {number} score - Sentiment score
 * @returns {string} Sentiment type: 'positive', 'negative', or 'neutral'
 */
function getSentimentType(label, score) {
    if (!label) return 'neutral';
    const l = label.toLowerCase();
    if (l.includes('positive')) return 'positive';
    if (l.includes('negative')) return 'negative';
    // Fallback to score if label doesn't help
    if (score > 0.15) return 'positive';
    if (score < -0.15) return 'negative';
    return 'neutral';
}


// ============================================================================
// CONSTANTS
// ============================================================================

const COLLAPSE_THRESHOLDS = {
    QUOTES: 5,
    ARTICLES: 6,
    FINANCIAL: 12,
    NETWORK: 5,
    BIAS_SOURCES: 5
};

// Toggle function for positions expand/collapse
function togglePositions(hiddenId, btn) {
    const hidden = document.getElementById(hiddenId);
    if (hidden.style.display === 'none') {
        hidden.style.display = 'block';
        btn.textContent = 'Show less';
    } else {
        hidden.style.display = 'none';
        const count = hidden.querySelectorAll('.position-card').length;
        btn.textContent = `Show ${count} more`;
    }
}

// Toggle function for Advanced Tools collapsible sections
function toggleAdvancedSection(contentId, btn) {
    const content = document.getElementById(contentId);
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.classList.add('expanded');
    } else {
        content.style.display = 'none';
        btn.classList.remove('expanded');
    }
}

// Get event ID from URL
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Format number with optional unit
function formatCurrency(amount, unit) {
    if (!amount) return '-';

    // Format the number part
    let formatted;
    if (amount >= 1e12) {
        formatted = `${(amount / 1e12).toFixed(1)}T`;
    } else if (amount >= 1e9) {
        formatted = `${(amount / 1e9).toFixed(1)}B`;
    } else if (amount >= 1e6) {
        formatted = `${(amount / 1e6).toFixed(1)}M`;
    } else if (amount >= 1e3) {
        formatted = `${(amount / 1e3).toFixed(1)}K`;
    } else {
        formatted = amount.toLocaleString();
    }

    // Add unit if it exists
    return unit ? `${formatted} ${unit}` : formatted;
}

// Sentiment color
function getSentimentColor(score) {
    if (score > 0.15) return '#10B981'; // positive
    if (score < -0.15) return '#EF4444'; // negative
    return '#6B7280'; // neutral
}

// Render metric cards
function renderMetrics(stats) {
    document.getElementById('totalArticles').textContent = stats.total_articles || 0;
    document.getElementById('totalSources').textContent = stats.sources || 0;
    document.getElementById('totalQuotes').textContent = stats.total_quotes || 0;
    document.getElementById('financialCount').textContent = stats.total_financial_mentions || 0;
}

// Render executive brief
function renderExecutiveBrief(brief) {
    const section = document.getElementById('executiveBriefSection');
    const content = document.getElementById('executiveBriefContent');

    if (!brief) {
        section.style.display = 'none';
        return;
    }

    // Convert newlines to paragraphs
    const paragraphs = brief.split('\n\n').filter(p => p.trim());
    content.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    section.style.display = 'block';
}

// Render policy overview - now updates page summary at top instead of separate card
function renderPolicyOverview(overview) {
    const summaryElement = document.getElementById('debateSummary');

    if (!overview || !summaryElement) {
        return;
    }

    // Use policy overview as the page summary
    summaryElement.textContent = overview;
}

// Render key arguments
function renderKeyArguments(args) {
    const section = document.getElementById('keyArgumentsSection');
    const forCol = document.querySelector('.arguments-for');
    const againstCol = document.querySelector('.arguments-against');

    if (!args || (!args.for?.length && !args.against?.length)) {
        section.style.display = 'none';
        return;
    }

    // Show/hide columns based on content
    if (args.for?.length) {
        document.getElementById('argumentsFor').innerHTML = args.for.map(arg => `<li>${arg}</li>`).join('');
        forCol.style.display = 'block';
    } else {
        forCol.style.display = 'none';
    }

    if (args.against?.length) {
        document.getElementById('argumentsAgainst').innerHTML = args.against.map(arg => `<li>${arg}</li>`).join('');
        againstCol.style.display = 'block';
    } else {
        againstCol.style.display = 'none';
    }

    section.style.display = 'block';
}

// Render policy positions
function renderPositions(positionsGrouped) {
    const section = document.getElementById('positionsSection');

    if (!positionsGrouped || (!positionsGrouped.support && !positionsGrouped.oppose && !positionsGrouped.neutral)) {
        section.style.display = 'none';
        return;
    }

    const supportList = positionsGrouped.support || [];
    const opposeList = positionsGrouped.oppose || [];
    const neutralList = positionsGrouped.neutral || [];
    const counts = positionsGrouped.counts || {};

    // Render summary stats - total pill first (leftmost)
    const summary = document.getElementById('positionsSummary');
    summary.innerHTML = `
        <div class="positions-stats bias-summary">
            <span class="bias-stat total">${counts.total || 0} total</span>
            <span class="bias-stat positive">${counts.support || 0} support</span>
            <span class="bias-stat neutral">${counts.neutral || 0} neutral</span>
            <span class="bias-stat negative">${counts.oppose || 0} oppose</span>
        </div>
    `;

    // Render position card
    const renderPosition = (pos) => {
        const confidenceClass = (pos.confidence || 'low').toLowerCase();
        const confidenceBadge = pos.confidence ?
            `<span class="confidence-badge confidence-${confidenceClass}">${pos.confidence}</span>` : '';

        return `
            <div class="position-card">
                <div class="position-speaker">
                    <strong>${pos.speaker || 'Unknown'}</strong>
                    ${pos.role ? `<div class="speaker-role">${pos.role}</div>` : ''}
                    ${confidenceBadge}
                </div>
                <div class="position-quote">"${pos.quote || 'No quote available'}"</div>
                ${pos.reasoning ? `<div class="position-reasoning"><strong>Why:</strong> ${pos.reasoning}</div>` : ''}
            </div>
        `;
    };

    // Collapse threshold for positions
    const COLLAPSE_THRESHOLD = 5;

    // Helper to render column with expand/collapse
    const renderColumnWithCollapse = (containerId, list, emptyMsg) => {
        const container = document.getElementById(containerId);
        if (list.length === 0) {
            container.innerHTML = `<p class="empty-state">${emptyMsg}</p>`;
            return;
        }

        const needsCollapse = list.length > COLLAPSE_THRESHOLD;
        const visibleItems = needsCollapse ? list.slice(0, COLLAPSE_THRESHOLD) : list;
        const hiddenItems = needsCollapse ? list.slice(COLLAPSE_THRESHOLD) : [];
        const hiddenId = `${containerId}-hidden`;

        container.innerHTML = `
            ${visibleItems.map(renderPosition).join('')}
            ${needsCollapse ? `
                <div id="${hiddenId}" class="hidden-items" style="display: none;">
                    ${hiddenItems.map(renderPosition).join('')}
                </div>
                <button class="expand-btn" onclick="togglePositions('${hiddenId}', this)">
                    Show ${hiddenItems.length} more
                </button>
            ` : ''}
        `;
    };

    // Render each column with collapse
    renderColumnWithCollapse('positionsSupport', supportList, 'No support positions found');
    renderColumnWithCollapse('positionsOppose', opposeList, 'No oppose positions found');
    renderColumnWithCollapse('positionsNeutral', neutralList, 'No neutral positions found');

    section.style.display = 'block';
}

// Render What's at Stake
function renderWhatsAtStake(stake) {
    const section = document.getElementById('whatsAtStakeSection');

    if (!stake || (!stake.winners?.length && !stake.losers?.length && !stake.risks?.length && !stake.opportunities?.length)) {
        section.style.display = 'none';
        return;
    }

    // Render each column and hide if empty
    const winnersCol = document.querySelector('.stake-winners');
    const losersCol = document.querySelector('.stake-losers');
    const risksCol = document.querySelector('.stake-risks');
    const oppsCol = document.querySelector('.stake-opportunities');

    if (stake.winners?.length) {
        document.getElementById('stakeWinners').innerHTML = stake.winners.map(w => `<li>${w}</li>`).join('');
        winnersCol.style.display = 'block';
    } else {
        winnersCol.style.display = 'none';
    }

    if (stake.losers?.length) {
        document.getElementById('stakeLosers').innerHTML = stake.losers.map(l => `<li>${l}</li>`).join('');
        losersCol.style.display = 'block';
    } else {
        losersCol.style.display = 'none';
    }

    if (stake.risks?.length) {
        document.getElementById('stakeRisks').innerHTML = stake.risks.map(r => `<li>${r}</li>`).join('');
        risksCol.style.display = 'block';
    } else {
        risksCol.style.display = 'none';
    }

    if (stake.opportunities?.length) {
        document.getElementById('stakeOpportunities').innerHTML = stake.opportunities.map(o => `<li>${o}</li>`).join('');
        oppsCol.style.display = 'block';
    } else {
        oppsCol.style.display = 'none';
    }

    section.style.display = 'block';
}

// Render Source Bias Map
function renderSourceBias(biasData) {
    const section = document.getElementById('sourceBiasSection');
    const zonesContainer = document.getElementById('biasZones');

    if (!biasData || !biasData.summary?.total_count) {
        section.style.display = 'none';
        return;
    }

    const summary = biasData.summary;
    const zones = biasData.zones;
    const MAX_VISIBLE = COLLAPSE_THRESHOLDS.BIAS_SOURCES;

    // Render summary
    document.getElementById('biasSummary').innerHTML = `
        <span class="bias-stat total">${summary.total_count} sources</span>
        <span class="bias-stat positive">${summary.positive_count} positive</span>
        <span class="bias-stat neutral">${summary.neutral_count} neutral</span>
        <span class="bias-stat negative">${summary.negative_count} negative</span>
    `;

    // Render zones dynamically with collapse
    const zoneConfigs = [
        { key: 'positive', label: 'Positive Coverage', sources: zones.positive || [] },
        { key: 'neutral', label: 'Neutral Coverage', sources: zones.neutral || [] },
        { key: 'negative', label: 'Negative Coverage', sources: zones.negative || [] }
    ];

    zonesContainer.innerHTML = zoneConfigs.filter(z => z.sources.length > 0).map(zone => {
        const visible = zone.sources.slice(0, MAX_VISIBLE);
        const hidden = zone.sources.slice(MAX_VISIBLE);
        const hiddenId = `bias-hidden-${zone.key}`;

        return `
            <div class="bias-zone bias-${zone.key}">
                <h4>${zone.label} (${zone.sources.length})</h4>
                <ul class="bias-list">
                    ${visible.map(s => `
                        <li>
                            <span class="source-name">${s.source}</span>
                            <span class="source-stats">${s.article_count}×, ${s.avg_sentiment > 0 ? '+' : ''}${s.avg_sentiment.toFixed(2)}</span>
                        </li>
                    `).join('')}
                </ul>
                ${hidden.length > 0 ? `
                    <ul class="bias-list collapsible-section collapsed" id="${hiddenId}">
                        ${hidden.map(s => `
                            <li>
                                <span class="source-name">${s.source}</span>
                                <span class="source-stats">${s.article_count}×, ${s.avg_sentiment > 0 ? '+' : ''}${s.avg_sentiment.toFixed(2)}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <button class="expand-btn-small" onclick="toggleCollapse('${hiddenId}', this)">
                        +${hidden.length} more ▼
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    section.style.display = 'block';
}

// Render Quote Network as compact insight panel
function renderQuoteNetwork(connections) {
    const section = document.getElementById('quoteNetworkSection');
    const container = document.getElementById('networkConnections');

    if (!connections || connections.length === 0) {
        section.style.display = 'none';
        return;
    }

    // Use global normalizeStance function (defined at top of file)

    // Analyze the network
    const speakers = {};
    const entities = {};

    connections.forEach(c => {
        const stance = normalizeStance(c.stance);

        // Track speakers
        if (!speakers[c.from]) {
            speakers[c.from] = { support: 0, oppose: 0, neutral: 0, total: 0 };
        }
        speakers[c.from][stance]++;
        speakers[c.from].total++;

        // Track entities
        if (!entities[c.to]) {
            entities[c.to] = { support: 0, oppose: 0, neutral: 0, total: 0, speakers: new Set() };
        }
        entities[c.to][stance]++;
        entities[c.to].total++;
        entities[c.to].speakers.add(c.from);
    });

    // Find controversial entities (have both support AND oppose) - get all for expandable
    const controversialAll = Object.entries(entities)
        .filter(([_, e]) => e.support > 0 && e.oppose > 0)
        .sort((a, b) => (b[1].support + b[1].oppose) - (a[1].support + a[1].oppose));

    // Find consensus entities (only one type of stance: only support, only oppose, or only neutral)
    const consensusAll = Object.entries(entities)
        .filter(([_, e]) => {
            const hasSupport = e.support > 0;
            const hasOppose = e.oppose > 0;
            const hasNeutral = e.neutral > 0;
            // Only one type of stance
            return (hasSupport && !hasOppose && !hasNeutral) ||
                (hasOppose && !hasSupport && !hasNeutral) ||
                (hasNeutral && !hasSupport && !hasOppose);
        })
        .sort((a, b) => b[1].total - a[1].total);

    // Top speakers by activity - get all for expandable
    const topSpeakersAll = Object.entries(speakers)
        .sort((a, b) => b[1].total - a[1].total);

    const MAX_VISIBLE = COLLAPSE_THRESHOLDS.NETWORK;

    // Helper to render bars with optional expand
    const renderBarRows = (items, type) => {
        const visible = items.slice(0, MAX_VISIBLE);
        const hidden = items.slice(MAX_VISIBLE);
        const hiddenId = `network-hidden-${type}`;

        const renderRow = ([name, data]) => {
            if (type === 'consensus') {
                // Single bar for consensus (only one stance type)
                const stanceType = data.support > 0 ? 'support' : data.oppose > 0 ? 'oppose' : 'neutral';
                const count = data.support || data.oppose || data.neutral;
                return `
                    <div class="entity-bar-row">
                        <span class="entity-name">${name}</span>
                        <div class="stance-bar">
                            <div class="bar-${stanceType}" style="width: 100%">${count}</div>
                        </div>
                    </div>
                `;
            } else {
                // Multi-bar for speakers and controversial
                const total = data.support + data.oppose + data.neutral || 1;
                const supportPct = Math.round((data.support / total) * 100);
                const opposePct = Math.round((data.oppose / total) * 100);
                const neutralPct = 100 - supportPct - opposePct;
                return `
                    <div class="entity-bar-row">
                        <span class="entity-name">${name}</span>
                        <div class="stance-bar">
                            ${data.support > 0 ? `<div class="bar-support" style="width: ${supportPct}%">${data.support}</div>` : ''}${data.neutral > 0 ? `<div class="bar-neutral" style="width: ${neutralPct}%">${data.neutral}</div>` : ''}${data.oppose > 0 ? `<div class="bar-oppose" style="width: ${opposePct}%">${data.oppose}</div>` : ''}
                        </div>
                    </div>
                `;
            }
        };

        return `
            ${visible.map(renderRow).join('')}
            ${hidden.length > 0 ? `
                <div class="collapsible-section collapsed" id="${hiddenId}">
                    ${hidden.map(renderRow).join('')}
                </div>
                <button class="expand-btn-small" onclick="toggleCollapse('${hiddenId}', this)">
                    Show ${hidden.length} more ▼
                </button>
            ` : ''}
        `;
    };

    // Stats
    const totalSpeakers = Object.keys(speakers).length;
    const totalEntities = Object.keys(entities).length;
    const supportCount = connections.filter(c => normalizeStance(c.stance) === 'support').length;
    const opposeCount = connections.filter(c => normalizeStance(c.stance) === 'oppose').length;
    const neutralCount = connections.filter(c => normalizeStance(c.stance) === 'neutral').length;

    container.innerHTML = `
        <div class="network-insights">
            <div class="network-stats-row">
                <span class="stat-pill">${totalSpeakers} Speakers</span>
                <span class="stat-pill">${totalEntities} Entities</span>
                <span class="stat-pill positive">${supportCount} Positive</span>
                <span class="stat-pill neutral">${neutralCount} Neutral</span>
                <span class="stat-pill negative">${opposeCount} Negative</span>
            </div>
            
            <div class="insight-grid-dynamic">
                ${topSpeakersAll.length > 0 ? `
                <div class="insight-section speakers">
                    <h4>Top Speakers</h4>
                    <div class="entity-bars">
                        ${renderBarRows(topSpeakersAll, 'speakers')}
                    </div>
                </div>
                ` : ''}
                
                ${controversialAll.length > 0 ? `
                <div class="insight-section controversial">
                    <h4>Controversial</h4>
                    <div class="entity-bars">
                        ${renderBarRows(controversialAll, 'controversial')}
                    </div>
                </div>
                ` : ''}
                
                ${consensusAll.length > 0 ? `
                <div class="insight-section consensus">
                    <h4>Consensus</h4>
                    <div class="entity-bars">
                        ${renderBarRows(consensusAll, 'consensus')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    section.style.display = 'block';
}

// Render popularity chart
function renderPopularityChart(trendData) {
    const ctx = document.getElementById('popularityChart').getContext('2d');

    if (!trendData || trendData.length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p style="color: var(--gray-500); text-align: center;">No trend data available</p>';
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: trendData.map(d => formatDate(d.date)),
            datasets: [{
                label: 'Articles Published',
                data: trendData.map(d => d.count),
                backgroundColor: 'rgba(14, 165, 233, 0.7)',
                borderColor: 'rgba(14, 165, 233, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Render sentiment chart
function renderSentimentChart(trendData) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

    if (!trendData || trendData.length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p style="color: var(--gray-500); text-align: center;">No sentiment data available</p>';
        return;
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(d => formatDate(d.date)),
            datasets: [{
                label: 'Average Sentiment',
                data: trendData.map(d => d.avg_sentiment),
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: trendData.map(d => getSentimentColor(d.avg_sentiment)),
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    min: -1,
                    max: 1,
                    ticks: {
                        callback: function (value) {
                            if (value === 1) return 'Positive';
                            if (value === 0) return 'Neutral';
                            if (value === -1) return 'Negative';
                            return '';
                        }
                    }
                }
            }
        }
    });
}

// Render entity tags
function renderEntities(entities) {
    const companiesContainer = document.getElementById('companiesTags');
    const politiciansContainer = document.getElementById('politiciansTags');
    const organizationsContainer = document.getElementById('organizationsTags');

    // Companies
    const companies = entities.companies || [];
    if (companies.length > 0) {
        companiesContainer.innerHTML = companies.slice(0, 10).map(c =>
            `<span class="entity-tag company">${c.name} <span class="count">${c.count}</span></span>`
        ).join('');
    } else {
        companiesContainer.innerHTML = '<span style="color: var(--gray-400); font-size: 0.875rem;">No companies mentioned</span>';
    }

    // Politicians
    const politicians = entities.politicians || [];
    if (politicians.length > 0) {
        politiciansContainer.innerHTML = politicians.slice(0, 10).map(p =>
            `<span class="entity-tag politician">${p.name} <span class="count">${p.count}</span></span>`
        ).join('');
    } else {
        politiciansContainer.innerHTML = '<span style="color: var(--gray-400); font-size: 0.875rem;">No politicians mentioned</span>';
    }

    // Organizations
    const organizations = entities.organizations || [];
    if (organizations.length > 0) {
        organizationsContainer.innerHTML = organizations.slice(0, 10).map(o =>
            `<span class="entity-tag">${o.name} <span class="count">${o.count}</span></span>`
        ).join('');
    } else {
        organizationsContainer.innerHTML = '<span style="color: var(--gray-400); font-size: 0.875rem;">No organizations mentioned</span>';
    }
}

// Render financial mentions as compact 3-column grid with collapse
function renderFinancial(financial) {
    const container = document.getElementById('financialList');
    const rawAmounts = financial.amounts || [];

    // Filter out null/invalid amounts
    const amounts = rawAmounts.filter(item =>
        item && item.amount != null && item.amount !== 'null'
    );

    if (amounts.length === 0) {
        document.getElementById('financialSection').style.display = 'none';
        return;
    }

    // Amounts already deduplicated server-side; keep reported_count if available
    const uniqueAmounts = amounts
        .map(item => ({ ...item, count: item.reported_count || item.count || 1 }))
        .sort((a, b) => b.count - a.count);

    const COLLAPSE_THRESHOLD = COLLAPSE_THRESHOLDS.FINANCIAL;
    const needsCollapse = uniqueAmounts.length > COLLAPSE_THRESHOLD;
    const visibleAmounts = needsCollapse ? uniqueAmounts.slice(0, COLLAPSE_THRESHOLD) : uniqueAmounts;
    const hiddenAmounts = needsCollapse ? uniqueAmounts.slice(COLLAPSE_THRESHOLD) : [];

    const renderItem = (item) => `
        <div class="financial-item">
            <span class="fi-value">${formatCurrency(item.amount, item.currency)}</span>
            <div class="fi-context-row">
                <span class="fi-context">${item.context || 'No context'}</span>
                ${item.count > 1 ? `<span class="fi-count">${item.count}×</span>` : ''}
            </div>
        </div>
    `;

    // Build compact 3-column grid - value + context visible at once
    container.innerHTML = `
        <div class="financial-grid">
            ${visibleAmounts.map(renderItem).join('')}
        </div>
        ${needsCollapse ? `
            <div class="collapsible-section collapsed" id="financialHidden">
                <div class="financial-grid">
                    ${hiddenAmounts.map(renderItem).join('')}
                </div>
            </div>
            <button class="expand-btn" onclick="toggleCollapse('financialHidden', this)">
                Show ${hiddenAmounts.length} more ▼
            </button>
        ` : ''}
    `;
}

// Toggle collapse/expand for sections
function toggleCollapse(sectionId, button) {
    const section = document.getElementById(sectionId);
    if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        button.innerHTML = button.innerHTML.replace('Show', 'Hide').replace('▼', '▲');
    } else {
        section.classList.add('collapsed');
        button.innerHTML = button.innerHTML.replace('Hide', 'Show').replace('▲', '▼');
    }
}

// Toggle expand/collapse for quote sources
function toggleSources(hiddenId, button) {
    const hidden = document.getElementById(hiddenId);
    if (hidden.style.display === 'none') {
        hidden.style.display = 'inline';
        button.textContent = 'show less';
    } else {
        hidden.style.display = 'none';
        const count = button.dataset.count;
        button.textContent = `+${count} more`;
    }
}

// Render quotes with collapse and filtering
function renderQuotes(quotes, sentimentFilter = 'all', speakerFilter = 'all') {
    const container = document.getElementById('quotesContainerAdv');

    // Use global normalizeStance function (defined at top of file)

    const hasServerSources = quotes.some(q => Array.isArray(q.sources) && q.sources.length > 0);
    let normalizedQuotes = [];

    if (hasServerSources) {
        normalizedQuotes = quotes.map(q => ({
            ...q,
            speaker: q.speaker || 'Unknown',
            sources: Array.isArray(q.sources) ? q.sources : [],
            reported_count: q.reported_count || q.sources?.length || 1
        }));
    } else {
        // Build article ID to source name mapping
        const articleSourceMap = {};
        allArticles.forEach(a => {
            articleSourceMap[a.id] = a.source_name || 'Unknown source';
        });

        // Group quotes by speaker + quote_text (normalized for comparison)
        const groupedQuotes = {};
        quotes.forEach(q => {
            const key = `${(q.speaker || 'Unknown').toLowerCase()}|||${q.quote_text.toLowerCase().trim()}`;
            if (!groupedQuotes[key]) {
                groupedQuotes[key] = {
                    speaker: q.speaker || 'Unknown',
                    speaker_role: q.speaker_role,
                    quote_text: q.quote_text,
                    stance: q.stance,
                    sources: []
                };
            }
            // Add source from this quote
            const sourceName = articleSourceMap[q.article_id] || 'Unknown source';
            if (!groupedQuotes[key].sources.includes(sourceName)) {
                groupedQuotes[key].sources.push(sourceName);
            }
        });

        normalizedQuotes = Object.values(groupedQuotes);
    }

    const filteredQuotes = normalizedQuotes.filter(q => {
        // Use sentiment field (or stance for legacy data) and normalizeSentiment for filtering
        const sentimentValue = q.sentiment || q.stance;
        const matchesSentiment = sentimentFilter === 'all' || normalizeSentiment(sentimentValue) === sentimentFilter;
        const matchesSpeaker = speakerFilter === 'all' || q.speaker === speakerFilter;
        return matchesSentiment && matchesSpeaker;
    });

    // Sort by number of sources (most reported first)
    filteredQuotes.sort((a, b) => (b.reported_count || b.sources.length) - (a.reported_count || a.sources.length));

    if (filteredQuotes.length === 0) {
        let filterDesc = '';
        if (sentimentFilter !== 'all' && speakerFilter !== 'all') {
            filterDesc = `${sentimentFilter} quotes from ${speakerFilter}`;
        } else if (sentimentFilter !== 'all') {
            filterDesc = `${sentimentFilter} quotes`;
        } else if (speakerFilter !== 'all') {
            filterDesc = `quotes from ${speakerFilter}`;
        }
        container.innerHTML = `<p style="color: var(--gray-500);">No ${filterDesc || 'quotes'} found.</p>`;
        return;
    }

    const COLLAPSE_THRESHOLD = COLLAPSE_THRESHOLDS.QUOTES;
    const needsCollapse = filteredQuotes.length > COLLAPSE_THRESHOLD;
    const visibleQuotes = needsCollapse ? filteredQuotes.slice(0, COLLAPSE_THRESHOLD) : filteredQuotes;
    const hiddenQuotes = needsCollapse ? filteredQuotes.slice(COLLAPSE_THRESHOLD) : [];

    const renderQuote = (q, index) => {
        // Get sentiment (new field) or stance (legacy) for backward compatibility
        const sentimentValue = q.sentiment || q.stance;
        const sentiment = normalizeSentiment(sentimentValue);

        const sourceCount = q.reported_count || q.sources.length;
        const MAX_VISIBLE = 3;
        const visibleSources = q.sources.slice(0, MAX_VISIBLE);
        const hiddenSources = q.sources.slice(MAX_VISIBLE);
        const hiddenCount = hiddenSources.length;

        let sourcesHtml = visibleSources.join(', ');
        if (hiddenCount > 0) {
            const hiddenId = `hidden-sources-${index}`;
            sourcesHtml += `<span class="sources-hidden" id="${hiddenId}" style="display: none;">, ${hiddenSources.join(', ')}</span>`;
            sourcesHtml += ` <span class="sources-more" data-count="${hiddenCount}" onclick="toggleSources('${hiddenId}', this)">+${hiddenCount} more</span>`;
        }

        // Map sentiment to quote card style (positive=green, negative=red, neutral=gray)
        const sentimentClass = sentiment === 'positive' ? 'quote-support' :
            sentiment === 'negative' ? 'quote-oppose' : 'quote-neutral';

        return `
            <div class="quote-card ${sentimentClass}">
                <div class="quote-text">"${q.quote_text}"</div>
                <div class="quote-attribution">
                    <div class="quote-speaker-info">
                        <strong>${q.speaker}</strong>
                        ${q.speaker_role ? `, ${q.speaker_role}` : ''}
                        ${sentiment ? ` <span class="stance-badge ${sentiment}">${sentiment}</span>` : ''}
                    </div>
                    <div class="quote-sources">${sourceCount > 1 ? `<span class="source-count">${sourceCount}×</span> ` : ''}${sourcesHtml}</div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        ${visibleQuotes.map((q, i) => renderQuote(q, i)).join('')}
        ${needsCollapse ? `
            <div class="collapsible-section collapsed" id="quotesHidden">
                ${hiddenQuotes.map((q, i) => renderQuote(q, i + visibleQuotes.length)).join('')}
            </div>
            <button class="expand-btn" onclick="toggleCollapse('quotesHidden', this)">
                Show ${hiddenQuotes.length} more ▼
            </button>
        ` : ''}
    `;
}

// Render articles list with collapse and filtering
function renderArticles(articles, sentimentFilter = 'all', sourceFilter = 'all') {
    const container = document.getElementById('articlesListAdv');


    // Use global getSentimentType function (defined at top of file)


    // Apply both sentiment and source filters
    const filteredArticles = articles.filter(article => {
        const matchesSentiment = sentimentFilter === 'all' || getSentimentType(article.sentiment_label, article.sentiment_score) === sentimentFilter;
        const matchesSource = sourceFilter === 'all' || (article.source_name || 'Unknown source') === sourceFilter;
        return matchesSentiment && matchesSource;
    });

    if (filteredArticles.length === 0) {
        let filterDesc = '';
        if (sentimentFilter !== 'all' && sourceFilter !== 'all') {
            filterDesc = `${sentimentFilter} articles from ${sourceFilter}`;
        } else if (sentimentFilter !== 'all') {
            filterDesc = `${sentimentFilter} articles`;
        } else if (sourceFilter !== 'all') {
            filterDesc = `articles from ${sourceFilter}`;
        }
        container.innerHTML = `<li style="color: var(--gray-500);">No ${filterDesc || 'articles'} found.</li>`;
        return;
    }

    const COLLAPSE_THRESHOLD = COLLAPSE_THRESHOLDS.ARTICLES;
    const needsCollapse = filteredArticles.length > COLLAPSE_THRESHOLD;
    const visibleArticles = needsCollapse ? filteredArticles.slice(0, COLLAPSE_THRESHOLD) : filteredArticles;
    const hiddenArticles = needsCollapse ? filteredArticles.slice(COLLAPSE_THRESHOLD) : [];

    const renderArticle = article => `
        <li class="article-item">
            <div>
                <div class="article-title">
                    <a href="${article.source_url || '#'}" target="_blank" rel="noopener">${article.title || 'Untitled'}</a>
                </div>
                <div class="article-meta">
                    ${article.source_name || 'Unknown source'} • ${formatDate(article.published_date)}
                </div>
            </div>
            ${article.sentiment_label ? `
                <span class="sentiment-badge sentiment-${getSentimentType(article.sentiment_label, article.sentiment_score)}">
                    ${article.sentiment_label}
                </span>
            ` : ''}
        </li>
    `;

    container.innerHTML = `
        ${visibleArticles.map(renderArticle).join('')}
        ${needsCollapse ? `
            <div class="collapsible-section collapsed" id="articlesHidden">
                ${hiddenArticles.map(renderArticle).join('')}
            </div>
            <button class="expand-btn" onclick="toggleCollapse('articlesHidden', this)">
                Show ${hiddenArticles.length} more ▼
            </button>
        ` : ''}
    `;
}

// Load and render dashboard
async function init() {
    const eventId = getEventId();

    if (!eventId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch(`data/debate_${eventId}.json`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Store data globally for filtering
        allQuotes = data.quotes || [];
        allArticles = data.articles || [];

        // Update header
        document.getElementById('debateTitle').textContent = data.debate.title || 'Debate Dashboard';
        document.getElementById('debateSummary').textContent = data.debate.summary || '';
        document.title = `${data.debate.title} - Policy Debate Tracker`;

        // Render executive brief (if available)
        renderExecutiveBrief(data.executive_brief);

        // Render policy overview (if available)
        renderPolicyOverview(data.policy_overview);

        // Render key arguments (if available)
        renderKeyArguments(data.key_arguments);

        // Render policy positions (if available)
        renderPositions(data.positions_grouped);

        // Render What's at Stake (if available)
        renderWhatsAtStake(data.whats_at_stake);

        // Render all sections
        renderMetrics(data.summary_stats || {});
        renderPopularityChart(data.popularity_trend);
        renderSentimentChart(data.sentiment_trend);
        renderEntities(data.entities || {});
        renderFinancial(data.financial || {});

        // Render data-driven analysis
        renderSourceBias(data.source_bias);
        renderQuoteNetwork(data.quote_network);

        renderQuotes(allQuotes, currentQuotesFilter);
        renderArticles(allArticles, currentArticlesFilter);

        // Set up filter button event listeners
        setupFilterListeners();

    } catch (error) {
        console.error('Failed to load event data:', error);

        document.getElementById('debateTitle').textContent = 'Debate Not Found';
        document.querySelector('.dashboard-grid').innerHTML = `
            <div class="glass-card-static" style="grid-column: span 12; text-align: center; padding: 3rem;">
                <h3>📁 Event Data Not Found</h3>
                <p style="color: var(--gray-500); margin-top: 0.5rem;">
                    The data for this event hasn't been generated yet. Run the pipeline first.
                </p>
                <a href="index.html" style="display: inline-block; margin-top: 1rem; color: var(--primary-600);">
                    ← Back to Events
                </a>
            </div>
        `;
    }
}

// Set up filter button event listeners
function setupFilterListeners() {
    // Quotes sentiment filter buttons
    document.querySelectorAll('#quotesFilterAdv .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('#quotesFilterAdv .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply filter
            currentQuotesFilter = btn.dataset.filter;
            renderQuotes(allQuotes, currentQuotesFilter, currentSpeakerFilter);
        });
    });

    // Speaker filter toggle
    const speakerToggle = document.getElementById('speakerFilterToggleAdv');
    const speakerList = document.getElementById('speakerFilterListAdv');

    if (speakerToggle && speakerList) {
        speakerToggle.addEventListener('click', () => {
            speakerToggle.classList.toggle('expanded');
            speakerList.classList.toggle('collapsed');
        });

        // Populate speaker buttons from quotes with counts (use filter-btn class for consistent styling)
        const speakerCounts = {};
        allQuotes.forEach(q => {
            const speaker = q.speaker || 'Unknown';
            speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
        });
        const speakers = Object.keys(speakerCounts).sort();
        speakerList.innerHTML = `
            <button class="filter-btn active" data-speaker="all">All Speakers (${allQuotes.length})</button>
            ${speakers.map(s => `<button class="filter-btn" data-speaker="${s}">${s} (${speakerCounts[s]})</button>`).join('')}
        `;

        // Speaker filter button clicks
        speakerList.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                speakerList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Apply filter
                currentSpeakerFilter = btn.dataset.speaker;
                renderQuotes(allQuotes, currentQuotesFilter, currentSpeakerFilter);

                // Update sentiment filter counts based on current speaker selection
                updateFilterCounts();
            });
        });
    }

    // Articles sentiment filter buttons
    document.querySelectorAll('#articlesFilterAdv .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('#articlesFilterAdv .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply filter
            currentArticlesFilter = btn.dataset.filter;
            renderArticles(allArticles, currentArticlesFilter, currentSourceFilter);
        });
    });

    // Source filter toggle
    const sourceToggle = document.getElementById('sourceFilterToggleAdv');
    const sourceList = document.getElementById('sourceFilterListAdv');

    if (sourceToggle && sourceList) {
        sourceToggle.addEventListener('click', () => {
            sourceToggle.classList.toggle('expanded');
            sourceList.classList.toggle('collapsed');
        });

        // Populate source buttons from articles with counts (use filter-btn class for consistent styling)
        const sourceCounts = {};
        allArticles.forEach(a => {
            const source = a.source_name || 'Unknown source';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        const sources = Object.keys(sourceCounts).sort();
        sourceList.innerHTML = `
            <button class="filter-btn active" data-source="all">All Sources (${allArticles.length})</button>
            ${sources.map(s => `<button class="filter-btn" data-source="${s}">${s} (${sourceCounts[s]})</button>`).join('')}
        `;

        // Source filter button clicks
        sourceList.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                sourceList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Apply filter
                currentSourceFilter = btn.dataset.source;
                renderArticles(allArticles, currentArticlesFilter, currentSourceFilter);

                // Update sentiment filter counts based on current source selection
                updateFilterCounts();
            });
        });
    }

    // Update counts
    updateFilterCounts();
}

// Update filter button counts
function updateFilterCounts() {
    // Use global normalizeStance function (defined at top of file)


    // Use global getSentimentType function (defined at top of file)

    // Count quotes by stance - filter by current speaker first
    const speakerFilteredQuotes = currentSpeakerFilter === 'all'
        ? allQuotes
        : allQuotes.filter(q => (q.speaker || 'Unknown') === currentSpeakerFilter);

    // Count quotes by sentiment (positive/neutral/negative) - filter by current speaker first
    const quoteCounts = { all: speakerFilteredQuotes.length, positive: 0, neutral: 0, negative: 0 };
    speakerFilteredQuotes.forEach(q => {
        // Use sentiment field (or stance for legacy data)
        const sentimentValue = q.sentiment || q.stance;
        const sentiment = normalizeSentiment(sentimentValue);
        quoteCounts[sentiment]++;
    });

    // Count articles by sentiment - filter by current source first
    const sourceFilteredArticles = currentSourceFilter === 'all'
        ? allArticles
        : allArticles.filter(a => (a.source_name || 'Unknown source') === currentSourceFilter);

    const articleCounts = { all: sourceFilteredArticles.length, positive: 0, neutral: 0, negative: 0 };
    sourceFilteredArticles.forEach(a => {
        const sentiment = getSentimentType(a.sentiment_label, a.sentiment_score);
        articleCounts[sentiment]++;
    });

    // Update quote filter buttons
    document.querySelectorAll('#quotesFilterAdv .filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = quoteCounts[filter] || 0;
        const countSpan = btn.querySelector('.count');
        if (countSpan) {
            countSpan.textContent = `(${count})`;
        }
    });

    // Update article filter buttons
    document.querySelectorAll('#articlesFilterAdv .filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = articleCounts[filter] || 0;
        const countSpan = btn.querySelector('.count');
        if (countSpan) {
            countSpan.textContent = `(${count})`;
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

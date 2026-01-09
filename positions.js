// Render policy positions
function renderPositions(positionsData) {
    const section = document.getElementById('positionsSection');

    if (!positionsData || (!positionsData.support && !positionsData.oppose && !positionsData.neutral)) {
        section.style.display = 'none';
        return;
    }

    const supportList = positionsData.support || [];
    const opposeList = positionsData.oppose || [];
    const neutralList = positionsData.neutral || [];
    const counts = positionsData.counts || {};

    // Render summary stats
    const summary = document.getElementById('positionsSummary');
    summary.innerHTML = `
        <div class="positions-stats bias-summary">
            <span class="bias-stat positive">${counts.support || 0} support</span>
            <span class="bias-stat neutral">${counts.neutral || 0} neutral</span>
            <span class="bias-stat negative">${counts.oppose || 0} oppose</span>
            <span class="bias-stat total">${counts.total || 0} total</span>
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
                    ${pos.role ? `<span class="speaker-role">${pos.role}</span>` : ''}
                    ${confidenceBadge}
                </div>
                <div class="position-quote">"${pos.quote || pos.text || 'No quote available'}"</div>
                ${pos.reasoning ? `<div class="position-reasoning">${pos.reasoning}</div>` : ''}
                ${pos.article_title ? `<div class="position-source">Source: ${pos.article_title}</div>` : ''}
            </div>
        `;
    };

    // Render each column
    document.getElementById('positionsSupport').innerHTML =
        supportList.length > 0 ? supportList.map(renderPosition).join('') :
            '<p class="empty-state">No support positions found</p>';

    document.getElementById('positionsOppose').innerHTML =
        opposeList.length > 0 ? opposeList.map(renderPosition).join('') :
            '<p class="empty-state">No oppose positions found</p>';

    document.getElementById('positionsNeutral').innerHTML =
        neutralList.length > 0 ? neutralList.map(renderPosition).join('') :
            '<p class="empty-state">No neutral positions found</p>';

    section.style.display = 'block';
}

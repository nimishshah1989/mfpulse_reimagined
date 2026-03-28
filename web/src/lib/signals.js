/**
 * Derive actionable signal cards from MarketPulse data + lens scores.
 */
export function deriveActionCards({
  regime,
  breadth,
  sentiment,
  sectors,
  topFundsByLens,
}) {
  const cards = [];

  // Breadth signals
  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  if (breadthPct != null) {
    if (breadthPct > 55) {
      cards.push({
        id: 'breadth-high',
        severity: 'green',
        title: 'Equity deployment favorable',
        description: `${Math.round(breadthPct)}% of stocks above 21 EMA — broad market participation supports equity allocation.`,
        funds: (topFundsByLens?.return_score || []).slice(0, 3),
        actions: [
          { label: 'Explore in Universe', route: '/universe' },
          { label: 'Simulate', route: '/strategies' },
        ],
      });
    } else if (breadthPct < 40) {
      cards.push({
        id: 'breadth-low',
        severity: 'red',
        title: 'Caution — reduce equity exposure',
        description: `Only ${Math.round(breadthPct)}% of stocks above 21 EMA — narrow breadth signals risk.`,
        funds: (topFundsByLens?.risk_score || []).slice(0, 3),
        actions: [{ label: 'Check Risk Scores', route: '/universe' }],
      });
    }
  }

  // Sector signals
  if (sectors && sectors.length > 0) {
    const leading = sectors.filter((s) => s.quadrant === 'Leading');
    leading.forEach((s) => {
      cards.push({
        id: `sector-${s.sector_name}`,
        severity: 'amber',
        title: `${s.sector_name} entering Leading quadrant`,
        description: `RS Score: ${s.rs_score?.toFixed(0) ?? '—'}, Momentum positive. Consider exposure to ${s.sector_name}-heavy funds.`,
        funds: [],
        actions: [{ label: 'View in Sector Intelligence', route: '/sectors' }],
      });
    });
  }

  // Sentiment signals
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  if (sentimentScore != null) {
    if (sentimentScore < 30) {
      cards.push({
        id: 'sentiment-fear',
        severity: 'green',
        title: 'Market fear — contrarian SIP opportunity',
        description: `Sentiment at ${Math.round(sentimentScore)}/100. Historically, starting SIPs during fear periods yields higher long-term returns.`,
        funds: (topFundsByLens?.consistency_score || []).slice(0, 3),
        actions: [{ label: 'Simulate SIP', route: '/strategies' }],
      });
    } else if (sentimentScore > 75) {
      cards.push({
        id: 'sentiment-euphoria',
        severity: 'amber',
        title: 'Market euphoria — tread carefully',
        description: `Sentiment at ${Math.round(sentimentScore)}/100. High sentiment often precedes corrections.`,
        funds: [],
        actions: [{ label: 'Check Universe', route: '/universe' }],
      });
    }
  }

  // Default card if nothing triggered
  if (cards.length === 0) {
    cards.push({
      id: 'neutral',
      severity: 'green',
      title: 'Market is neutral',
      description: 'No strong signals right now. Continue with your regular investment plan.',
      funds: [],
      actions: [{ label: 'Explore Universe', route: '/universe' }],
    });
  }

  return cards;
}

/**
 * Get market summary for KPI cards.
 */
export function getMarketSummary(regime, breadth, sentiment) {
  return {
    regimeLabel: regime?.regime_label || 'Unknown',
    breadthPct: breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema ?? null,
    sentimentScore: sentiment?.composite_score ?? sentiment?.score ?? null,
  };
}

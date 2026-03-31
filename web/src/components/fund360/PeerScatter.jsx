import { useRef, useEffect, useMemo } from 'react';

/**
 * PeerScatter — mini scatter chart showing peers as dots (risk_score vs return_1y)
 * with the current fund highlighted.
 *
 * Props:
 *   fund        object  — current fund (needs risk_score, return_1y)
 *   lensScores  object  — current fund's lens scores
 *   peers       array   — peer fund objects
 *   fundDetail  object  — full fund detail for returns
 */
export default function PeerScatter({ fund, lensScores, peers, fundDetail }) {
  const canvasRef = useRef(null);
  const W = 480;
  const H = 320;
  const margin = { top: 24, right: 24, bottom: 36, left: 44 };

  const fundRisk = Number(lensScores?.risk_score) || 50;
  const fundReturn = Number(fundDetail?.returns?.return_1y ?? fundDetail?.return_1y) || 0;

  const peerPoints = useMemo(() => {
    if (!peers?.length) return [];
    return peers
      .filter((p) => p.risk_score != null)
      .map((p) => ({
        risk: Number(p.risk_score) || 50,
        ret: Number(p.return_1y) || 0,
        name: p.fund_name || p.legal_name || '',
      }));
  }, [peers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    // Compute domains
    const allRisks = [...peerPoints.map((p) => p.risk), fundRisk];
    const allRets = [...peerPoints.map((p) => p.ret), fundReturn];
    const riskMin = Math.min(...allRisks) - 5;
    const riskMax = Math.max(...allRisks) + 5;
    const retMin = Math.min(...allRets) - 3;
    const retMax = Math.max(...allRets) + 3;

    const xScale = (v) => margin.left + ((v - riskMin) / (riskMax - riskMin || 1)) * iW;
    const yScale = (v) => margin.top + iH - ((v - retMin) / (retMax - retMin || 1)) * iH;

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(margin.left, margin.top, iW, iH);

    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (iH / 4) * i;
      ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + iW, y); ctx.stroke();
    }

    // Peer dots
    for (const p of peerPoints) {
      const px = xScale(p.risk);
      const py = yScale(p.ret);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Current fund — highlighted
    const fx = xScale(fundRisk);
    const fy = yScale(fundReturn);
    ctx.beginPath();
    ctx.arc(fx, fy, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13, 148, 136, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 2;
    ctx.stroke();

    // "You" label
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = '#0d9488';
    ctx.textAlign = 'center';
    ctx.fillText('This Fund', fx, fy - 12);

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Risk Score →', margin.left + iW / 2, H - 4);
    ctx.save();
    ctx.translate(10, margin.top + iH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('1Y Return % ↑', 0, 0);
    ctx.restore();

    // Tick labels
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(riskMin).toString(), margin.left, H - 16);
    ctx.fillText(Math.round(riskMax).toString(), margin.left + iW, H - 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(retMin)}%`, margin.left - 4, margin.top + iH);
    ctx.fillText(`${Math.round(retMax)}%`, margin.left - 4, margin.top + 10);

  }, [peerPoints, fundRisk, fundReturn, W, H, margin]);

  if (!peers?.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-slate-400">No peer data available for scatter plot</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} style={{ width: W, height: H }} className="rounded-lg" />
      <p className="text-[10px] text-slate-400 mt-2">
        {peerPoints.length} peers in {fund?.category_name || 'category'}
      </p>
    </div>
  );
}

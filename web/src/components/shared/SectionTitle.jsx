import InfoIcon from './InfoIcon';

export default function SectionTitle({ children, tip, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-1.5">
        <span className="section-title">{children}</span>
        {tip && <InfoIcon tip={tip} />}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

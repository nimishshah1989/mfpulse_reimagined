/**
 * FilterBreadcrumbs — shows active filters as removable tags with Clear All.
 * Fixes the "can't navigate back after clicking a category" bug.
 */

export default function FilterBreadcrumbs({
  filters,
  globalFilters,
  activePreset,
  selectedTier,
  searchQuery,
  onRemoveCategory,
  onRemoveAmc,
  onRemovePreset,
  onRemoveTier,
  onRemoveSearch,
  onClearAll,
}) {
  const tags = [];

  // Categories
  if (filters.categories?.length > 0) {
    filters.categories.forEach((cat) => {
      tags.push({ label: cat, type: 'category', value: cat });
    });
  }

  // AMCs
  if (filters.amcs?.length > 0) {
    filters.amcs.forEach((amc) => {
      tags.push({ label: amc, type: 'amc', value: amc });
    });
  }

  // AUM range
  if (filters.aumRange && filters.aumRange !== 'Any AUM') {
    tags.push({ label: `AUM: ${filters.aumRange}`, type: 'aumRange', value: filters.aumRange });
  }

  // Active preset
  if (activePreset && activePreset !== 'custom') {
    tags.push({ label: `Preset: ${activePreset}`, type: 'preset', value: activePreset });
  }

  // Selected tier
  if (selectedTier) {
    tags.push({ label: `Tier: ${selectedTier}`, type: 'tier', value: selectedTier });
  }

  // NL Search
  if (searchQuery) {
    tags.push({ label: `Search: "${searchQuery}"`, type: 'search', value: searchQuery });
  }

  if (tags.length === 0) return null;

  function handleRemove(tag) {
    switch (tag.type) {
      case 'category': onRemoveCategory?.(tag.value); break;
      case 'amc': onRemoveAmc?.(tag.value); break;
      case 'preset': onRemovePreset?.(); break;
      case 'tier': onRemoveTier?.(); break;
      case 'search': onRemoveSearch?.(); break;
      default: break;
    }
  }

  return (
    <div className="flex items-center gap-2 glass-card px-4 py-2.5 animate-in">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
        Filtered by
      </span>
      <div className="flex items-center gap-2 flex-wrap flex-1">
        {tags.map((tag) => (
          <span
            key={`${tag.type}-${tag.value}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md"
          >
            {tag.label}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="text-slate-400 hover:text-red-500 text-sm leading-none ml-0.5"
              aria-label={`Remove ${tag.label}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] font-semibold text-red-500 hover:text-red-700 shrink-0"
      >
        Clear All
      </button>
    </div>
  );
}

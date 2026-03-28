export const initialState = {
  funds: [],
  allocations: {},
  lockedFunds: new Set(),
  overrides: [],
  selectedFundId: null,
  backtestData: null,
  backtestLoading: false,
};

function redistributeWeights(allocations, lockedFunds, funds) {
  const unlocked = funds.filter((f) => !lockedFunds.has(f.mstar_id));
  if (unlocked.length === 0) return allocations;

  const lockedTotal = funds
    .filter((f) => lockedFunds.has(f.mstar_id))
    .reduce((s, f) => s + (allocations[f.mstar_id] || 0), 0);

  const remaining = 100 - lockedTotal;
  const perFund = remaining / unlocked.length;

  const newAlloc = { ...allocations };
  unlocked.forEach((f) => {
    newAlloc[f.mstar_id] = Math.round(perFund * 10) / 10;
  });
  return newAlloc;
}

export function strategyReducer(state, action) {
  switch (action.type) {
    case 'ADD_FUND': {
      const fund = action.fund;
      if (state.funds.some((f) => f.mstar_id === fund.mstar_id)) return state;
      const newFunds = [...state.funds, fund];
      const newAlloc = redistributeWeights(
        { ...state.allocations, [fund.mstar_id]: 0 },
        state.lockedFunds,
        newFunds
      );
      return { ...state, funds: newFunds, allocations: newAlloc };
    }

    case 'REMOVE_FUND': {
      const id = action.mstar_id;
      const newFunds = state.funds.filter((f) => f.mstar_id !== id);
      const newLocked = new Set(state.lockedFunds);
      newLocked.delete(id);
      const { [id]: _, ...restAlloc } = state.allocations;
      const newAlloc = redistributeWeights(restAlloc, newLocked, newFunds);
      return {
        ...state,
        funds: newFunds,
        allocations: newAlloc,
        lockedFunds: newLocked,
        selectedFundId: state.selectedFundId === id ? null : state.selectedFundId,
      };
    }

    case 'SET_ALLOCATION': {
      const { mstar_id, weight } = action;
      const clamped = Math.max(0, Math.min(100, weight));
      const newAlloc = { ...state.allocations, [mstar_id]: clamped };

      // Redistribute remaining among unlocked funds (excluding the changed one)
      const lockedPlusChanged = new Set(state.lockedFunds);
      lockedPlusChanged.add(mstar_id);
      const unlocked = state.funds.filter((f) => !lockedPlusChanged.has(f.mstar_id));

      if (unlocked.length > 0) {
        const usedTotal = state.funds
          .filter((f) => lockedPlusChanged.has(f.mstar_id))
          .reduce((s, f) => s + (newAlloc[f.mstar_id] || 0), 0);
        const remaining = Math.max(0, 100 - usedTotal);
        const perFund = remaining / unlocked.length;
        unlocked.forEach((f) => {
          newAlloc[f.mstar_id] = Math.round(perFund * 10) / 10;
        });
      }

      return { ...state, allocations: newAlloc };
    }

    case 'TOGGLE_LOCK': {
      const newLocked = new Set(state.lockedFunds);
      if (newLocked.has(action.mstar_id)) {
        newLocked.delete(action.mstar_id);
      } else {
        newLocked.add(action.mstar_id);
      }
      return { ...state, lockedFunds: newLocked };
    }

    case 'SELECT_FUND':
      return { ...state, selectedFundId: action.mstar_id };

    case 'ADD_OVERRIDE':
      return { ...state, overrides: [...state.overrides, action.override] };

    case 'REMOVE_OVERRIDE':
      return { ...state, overrides: state.overrides.filter((o) => o.id !== action.id) };

    case 'SET_BACKTEST_DATA':
      return { ...state, backtestData: action.data, backtestLoading: false };

    case 'SET_BACKTEST_LOADING':
      return { ...state, backtestLoading: action.loading };

    case 'LOAD_STRATEGY':
      return {
        ...state,
        funds: action.data.funds || [],
        allocations: action.data.allocations || {},
        overrides: action.data.overrides || [],
      };

    case 'RESET':
      return { ...initialState, lockedFunds: new Set() };

    default:
      return state;
  }
}

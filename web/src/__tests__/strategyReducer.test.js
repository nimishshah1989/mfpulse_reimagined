import { describe, it, expect } from '@jest/globals';
import { strategyReducer, initialState } from '../lib/strategyReducer';

const makeFund = (id, name) => ({ mstar_id: id, fund_name: name || `Fund ${id}` });

describe('strategyReducer', () => {
  describe('ADD_FUND', () => {
    it('adds a fund and redistributes weights', () => {
      const state = strategyReducer(initialState, {
        type: 'ADD_FUND',
        fund: makeFund('F001'),
      });
      expect(state.funds).toHaveLength(1);
      expect(state.allocations['F001']).toBe(100);
    });

    it('splits weights equally when adding second fund', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F002') });
      expect(state.funds).toHaveLength(2);
      expect(state.allocations['F001']).toBe(50);
      expect(state.allocations['F002']).toBe(50);
    });

    it('does not add duplicate fund', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F001') });
      expect(state.funds).toHaveLength(1);
    });
  });

  describe('REMOVE_FUND', () => {
    it('removes fund and redistributes', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F002') });
      state = strategyReducer(state, { type: 'REMOVE_FUND', mstar_id: 'F001' });
      expect(state.funds).toHaveLength(1);
      expect(state.allocations['F001']).toBeUndefined();
      expect(state.allocations['F002']).toBe(100);
    });

    it('clears selectedFundId if removed fund was selected', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'SELECT_FUND', mstar_id: 'F001' });
      state = strategyReducer(state, { type: 'REMOVE_FUND', mstar_id: 'F001' });
      expect(state.selectedFundId).toBeNull();
    });

    it('preserves selectedFundId if different fund removed', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F002') });
      state = strategyReducer(state, { type: 'SELECT_FUND', mstar_id: 'F001' });
      state = strategyReducer(state, { type: 'REMOVE_FUND', mstar_id: 'F002' });
      expect(state.selectedFundId).toBe('F001');
    });
  });

  describe('SET_ALLOCATION', () => {
    it('sets weight and redistributes remaining', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F002') });
      state = strategyReducer(state, { type: 'ADD_FUND', fund: makeFund('F003') });
      state = strategyReducer(state, { type: 'SET_ALLOCATION', mstar_id: 'F001', weight: 60 });
      expect(state.allocations['F001']).toBe(60);
      expect(state.allocations['F002']).toBe(20);
      expect(state.allocations['F003']).toBe(20);
    });

    it('clamps weight to 0-100 range', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'SET_ALLOCATION', mstar_id: 'F001', weight: 150 });
      expect(state.allocations['F001']).toBe(100);

      state = strategyReducer(state, { type: 'SET_ALLOCATION', mstar_id: 'F001', weight: -10 });
      expect(state.allocations['F001']).toBe(0);
    });
  });

  describe('TOGGLE_LOCK', () => {
    it('toggles fund lock state', () => {
      let state = strategyReducer(initialState, { type: 'TOGGLE_LOCK', mstar_id: 'F001' });
      expect(state.lockedFunds.has('F001')).toBe(true);

      state = strategyReducer(state, { type: 'TOGGLE_LOCK', mstar_id: 'F001' });
      expect(state.lockedFunds.has('F001')).toBe(false);
    });
  });

  describe('SELECT_FUND', () => {
    it('sets selectedFundId', () => {
      const state = strategyReducer(initialState, { type: 'SELECT_FUND', mstar_id: 'F001' });
      expect(state.selectedFundId).toBe('F001');
    });
  });

  describe('overrides', () => {
    it('ADD_OVERRIDE appends', () => {
      const override = { id: 'o1', type: 'FUND_BOOST', target_id: 'F001' };
      const state = strategyReducer(initialState, { type: 'ADD_OVERRIDE', override });
      expect(state.overrides).toHaveLength(1);
      expect(state.overrides[0].id).toBe('o1');
    });

    it('REMOVE_OVERRIDE removes by id', () => {
      let state = strategyReducer(initialState, {
        type: 'ADD_OVERRIDE',
        override: { id: 'o1', type: 'FUND_BOOST' },
      });
      state = strategyReducer(state, {
        type: 'ADD_OVERRIDE',
        override: { id: 'o2', type: 'FUND_SUPPRESS' },
      });
      state = strategyReducer(state, { type: 'REMOVE_OVERRIDE', id: 'o1' });
      expect(state.overrides).toHaveLength(1);
      expect(state.overrides[0].id).toBe('o2');
    });
  });

  describe('backtest', () => {
    it('SET_BACKTEST_LOADING sets loading', () => {
      const state = strategyReducer(initialState, { type: 'SET_BACKTEST_LOADING', loading: true });
      expect(state.backtestLoading).toBe(true);
    });

    it('SET_BACKTEST_DATA sets data and clears loading', () => {
      let state = strategyReducer(initialState, { type: 'SET_BACKTEST_LOADING', loading: true });
      state = strategyReducer(state, { type: 'SET_BACKTEST_DATA', data: { xirr: 12 } });
      expect(state.backtestData).toEqual({ xirr: 12 });
      expect(state.backtestLoading).toBe(false);
    });
  });

  describe('LOAD_STRATEGY', () => {
    it('loads strategy data', () => {
      const state = strategyReducer(initialState, {
        type: 'LOAD_STRATEGY',
        data: {
          funds: [makeFund('F001'), makeFund('F002')],
          allocations: { F001: 60, F002: 40 },
          overrides: [{ id: 'o1' }],
        },
      });
      expect(state.funds).toHaveLength(2);
      expect(state.allocations['F001']).toBe(60);
      expect(state.overrides).toHaveLength(1);
    });
  });

  describe('RESET', () => {
    it('resets to initial state', () => {
      let state = strategyReducer(initialState, { type: 'ADD_FUND', fund: makeFund('F001') });
      state = strategyReducer(state, { type: 'RESET' });
      expect(state.funds).toHaveLength(0);
      expect(state.lockedFunds.size).toBe(0);
    });
  });

  describe('default', () => {
    it('returns current state for unknown action', () => {
      const state = strategyReducer(initialState, { type: 'UNKNOWN' });
      expect(state).toBe(initialState);
    });
  });
});

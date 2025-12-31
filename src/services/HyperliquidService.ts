import ky from 'ky';
import type { Address } from 'viem';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export interface HyperliquidPosition {
  coin: string;
  size: number;
  side: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice: number;
  leverage: number;
  leverageType: 'cross' | 'isolated';
  unrealizedPnl: number;
  notionalValue: number;
  fundingRate: number;
  fundingRateAnnualized: number;
}

interface RawHyperliquidPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    leverage: {
      value: number;
      type: string;
    };
    unrealizedPnl: string;
  };
}

interface ClearinghouseState {
  assetPositions: RawHyperliquidPosition[];
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
  };
}

interface AssetContext {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: string[];
}

interface MetaResponse {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
  }>;
}

type MetaAndAssetCtxsResponse = [MetaResponse, AssetContext[]];

export class HyperliquidService {
  private fundingRatesCache: Record<string, number> = {};

  async getUserPositions(address: Address): Promise<HyperliquidPosition[]> {
    try {
      const [clearinghouse, fundingRates] = await Promise.all([
        this.fetchClearinghouseState(address),
        this.getFundingRates(),
      ]);

      if (!clearinghouse.assetPositions || clearinghouse.assetPositions.length === 0) {
        return [];
      }

      return clearinghouse.assetPositions
        .map(asset => this.transformPosition(asset, fundingRates))
        .filter(pos => pos.size !== 0);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Hyperliquid positions: ${error.message}`);
      }
      throw error;
    }
  }

  private async fetchClearinghouseState(address: Address): Promise<ClearinghouseState> {
    return ky
      .post(HYPERLIQUID_API, {
        json: {
          type: 'clearinghouseState',
          user: address,
        },
        timeout: 15000,
      })
      .json<ClearinghouseState>();
  }

  async getFundingRates(): Promise<Record<string, number>> {
    if (Object.keys(this.fundingRatesCache).length > 0) {
      return this.fundingRatesCache;
    }

    try {
      const response = await ky
        .post(HYPERLIQUID_API, {
          json: {
            type: 'metaAndAssetCtxs',
          },
          timeout: 15000,
        })
        .json<MetaAndAssetCtxsResponse>();

      const [meta, assetCtxs] = response;
      const rates: Record<string, number> = {};

      for (let i = 0; i < meta.universe.length; i++) {
        const assetName = meta.universe[i].name;
        const ctx = assetCtxs[i];
        if (ctx) {
          rates[assetName] = parseFloat(ctx.funding);
        }
      }

      this.fundingRatesCache = rates;
      return rates;
    } catch (error) {
      console.warn('Failed to fetch Hyperliquid funding rates');
      return {};
    }
  }

  private transformPosition(
    raw: RawHyperliquidPosition,
    fundingRates: Record<string, number>
  ): HyperliquidPosition {
    const size = parseFloat(raw.position.szi);
    const entryPrice = parseFloat(raw.position.entryPx);
    const leverage = raw.position.leverage.value;
    const unrealizedPnl = parseFloat(raw.position.unrealizedPnl);
    const fundingRate = fundingRates[raw.position.coin] || 0;
    const fundingRateAnnualized = fundingRate * 24 * 365 * 100;

    return {
      coin: raw.position.coin,
      size: Math.abs(size),
      side: size > 0 ? 'LONG' : size < 0 ? 'SHORT' : 'NEUTRAL',
      entryPrice,
      leverage,
      leverageType: raw.position.leverage.type === 'cross' ? 'cross' : 'isolated',
      unrealizedPnl,
      notionalValue: Math.abs(size) * entryPrice,
      fundingRate,
      fundingRateAnnualized,
    };
  }

  async getMarkPrices(): Promise<Record<string, number>> {
    try {
      const response = await ky
        .post(HYPERLIQUID_API, {
          json: {
            type: 'allMids',
          },
          timeout: 10000,
        })
        .json<Record<string, string>>();

      const prices: Record<string, number> = {};
      for (const [coin, price] of Object.entries(response)) {
        prices[coin] = parseFloat(price);
      }
      return prices;
    } catch (error) {
      console.warn('Failed to fetch Hyperliquid mark prices');
      return {};
    }
  }
}

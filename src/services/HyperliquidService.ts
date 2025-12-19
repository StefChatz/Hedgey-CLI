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

export class HyperliquidService {
  async getUserPositions(address: Address): Promise<HyperliquidPosition[]> {
    try {
      const response = await ky
        .post(HYPERLIQUID_API, {
          json: {
            type: 'clearinghouseState',
            user: address,
          },
          timeout: 15000,
        })
        .json<ClearinghouseState>();

      if (!response.assetPositions || response.assetPositions.length === 0) {
        return [];
      }

      return response.assetPositions
        .map(asset => this.transformPosition(asset))
        .filter(pos => pos.size !== 0);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Hyperliquid positions: ${error.message}`);
      }
      throw error;
    }
  }

  private transformPosition(raw: RawHyperliquidPosition): HyperliquidPosition {
    const size = parseFloat(raw.position.szi);
    const entryPrice = parseFloat(raw.position.entryPx);
    const leverage = raw.position.leverage.value;
    const unrealizedPnl = parseFloat(raw.position.unrealizedPnl);

    return {
      coin: raw.position.coin,
      size: Math.abs(size),
      side: size > 0 ? 'LONG' : size < 0 ? 'SHORT' : 'NEUTRAL',
      entryPrice,
      leverage,
      leverageType: raw.position.leverage.type === 'cross' ? 'cross' : 'isolated',
      unrealizedPnl,
      notionalValue: Math.abs(size) * entryPrice,
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

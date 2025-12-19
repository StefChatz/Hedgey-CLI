import type { HyperliquidPosition } from '../services/HyperliquidService';
import type { Position } from '../types/position';

export interface CombinedExposure {
  asset: string;
  aaveExposure: {
    net: number;
    netUSD: number;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  };
  hyperliquidExposure: {
    size: number;
    sizeUSD: number;
    side: 'LONG' | 'SHORT' | 'NEUTRAL';
    leverage: number;
    unrealizedPnl: number;
  };
  netExposure: {
    amount: number;
    amountUSD: number;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  };
  hedgeRatio: number;
  price: number;
}

export interface HedgeAnalysis {
  byAsset: Record<string, CombinedExposure>;
  totals: {
    aaveTotalUSD: number;
    hyperliquidTotalUSD: number;
    netExposureUSD: number;
    overallHedgeRatio: number;
  };
  effectiveness: {
    perfectlyHedged: string[];
    partiallyHedged: string[];
    unhedged: string[];
    overHedged: string[];
  };
}

export class HedgeAnalyzer {
  analyze(
    aavePositions: Position[],
    hyperliquidPositions: HyperliquidPosition[],
    prices: Record<string, number>
  ): HedgeAnalysis {
    const allAssets = this.getAllAssets(aavePositions, hyperliquidPositions);
    const byAsset: Record<string, CombinedExposure> = {};

    for (const asset of allAssets) {
      byAsset[asset] = this.analyzeAsset(asset, aavePositions, hyperliquidPositions, prices);
    }

    const totals = this.calculateTotals(byAsset);
    const effectiveness = this.categorizeEffectiveness(byAsset);

    return {
      byAsset,
      totals,
      effectiveness,
    };
  }

  private getAllAssets(
    aavePositions: Position[],
    hyperliquidPositions: HyperliquidPosition[]
  ): string[] {
    const aaveAssets = aavePositions.map(p => this.normalizeAsset(p.asset));
    const hlAssets = hyperliquidPositions.map(p => p.coin);
    return [...new Set([...aaveAssets, ...hlAssets])];
  }

  private normalizeAsset(asset: string): string {
    const mapping: Record<string, string> = {
      WETH: 'ETH',
      wstETH: 'ETH',
      WBTC: 'BTC',
    };
    return mapping[asset] || asset;
  }

  private analyzeAsset(
    asset: string,
    aavePositions: Position[],
    hyperliquidPositions: HyperliquidPosition[],
    prices: Record<string, number>
  ): CombinedExposure {
    const aaveExposure = this.getAaveExposure(asset, aavePositions);
    const hyperliquidExposure = this.getHyperliquidExposure(asset, hyperliquidPositions);
    const price = prices[asset] || 0;

    const netAmount = aaveExposure.net + this.getSignedSize(hyperliquidExposure);
    const netAmountUSD = aaveExposure.netUSD + this.getSignedSizeUSD(hyperliquidExposure);

    const hedgeRatio = this.calculateHedgeRatio(
      aaveExposure.netUSD,
      hyperliquidExposure.sizeUSD,
      hyperliquidExposure.side
    );

    return {
      asset,
      aaveExposure: {
        net: aaveExposure.net,
        netUSD: aaveExposure.netUSD,
        direction: aaveExposure.net > 0 ? 'LONG' : aaveExposure.net < 0 ? 'SHORT' : 'NEUTRAL',
      },
      hyperliquidExposure,
      netExposure: {
        amount: netAmount,
        amountUSD: netAmountUSD,
        direction: netAmount > 0 ? 'LONG' : netAmount < 0 ? 'SHORT' : 'NEUTRAL',
      },
      hedgeRatio,
      price,
    };
  }

  private getAaveExposure(asset: string, positions: Position[]) {
    const normalized = this.normalizeAsset(asset);
    let net = 0;
    let netUSD = 0;

    for (const pos of positions) {
      const posAsset = this.normalizeAsset(pos.asset);
      if (posAsset === normalized) {
        net += pos.supplied - pos.borrowed;
        netUSD += pos.suppliedUSD - pos.borrowedUSD;
      }
    }

    return {
      net,
      netUSD,
      direction: net > 0 ? 'LONG' : net < 0 ? 'SHORT' : 'NEUTRAL',
    };
  }

  private getHyperliquidExposure(asset: string, positions: HyperliquidPosition[]) {
    const position = positions.find(p => p.coin === asset);

    if (!position) {
      return {
        size: 0,
        sizeUSD: 0,
        side: 'NEUTRAL' as const,
        leverage: 0,
        unrealizedPnl: 0,
      };
    }

    return {
      size: position.size,
      sizeUSD: position.notionalValue,
      side: position.side,
      leverage: position.leverage,
      unrealizedPnl: position.unrealizedPnl,
    };
  }

  private getSignedSize(exposure: CombinedExposure['hyperliquidExposure']): number {
    if (exposure.side === 'SHORT') return -exposure.size;
    if (exposure.side === 'LONG') return exposure.size;
    return 0;
  }

  private getSignedSizeUSD(exposure: CombinedExposure['hyperliquidExposure']): number {
    if (exposure.side === 'SHORT') return -exposure.sizeUSD;
    if (exposure.side === 'LONG') return exposure.sizeUSD;
    return 0;
  }

  private calculateHedgeRatio(
    aaveUSD: number,
    hyperliquidUSD: number,
    hyperliquidSide: 'LONG' | 'SHORT' | 'NEUTRAL'
  ): number {
    if (aaveUSD === 0) return 0;

    const aaveDirection = aaveUSD > 0 ? 'LONG' : 'SHORT';

    if (aaveDirection === 'LONG' && hyperliquidSide === 'SHORT') {
      return Math.min((hyperliquidUSD / Math.abs(aaveUSD)) * 100, 100);
    }

    if (aaveDirection === 'SHORT' && hyperliquidSide === 'LONG') {
      return Math.min((hyperliquidUSD / Math.abs(aaveUSD)) * 100, 100);
    }

    return 0;
  }

  private calculateTotals(byAsset: Record<string, CombinedExposure>) {
    let aaveTotalUSD = 0;
    let hyperliquidTotalUSD = 0;
    let netExposureUSD = 0;

    for (const exposure of Object.values(byAsset)) {
      aaveTotalUSD += Math.abs(exposure.aaveExposure.netUSD);
      hyperliquidTotalUSD += Math.abs(exposure.hyperliquidExposure.sizeUSD);
      netExposureUSD += Math.abs(exposure.netExposure.amountUSD);
    }

    const overallHedgeRatio =
      aaveTotalUSD > 0 ? Math.min(((aaveTotalUSD - netExposureUSD) / aaveTotalUSD) * 100, 100) : 0;

    return {
      aaveTotalUSD,
      hyperliquidTotalUSD,
      netExposureUSD,
      overallHedgeRatio,
    };
  }

  private categorizeEffectiveness(byAsset: Record<string, CombinedExposure>) {
    const perfectlyHedged: string[] = [];
    const partiallyHedged: string[] = [];
    const unhedged: string[] = [];
    const overHedged: string[] = [];

    for (const [asset, exposure] of Object.entries(byAsset)) {
      if (exposure.aaveExposure.netUSD === 0) continue;

      if (exposure.hedgeRatio >= 95 && exposure.hedgeRatio <= 105) {
        perfectlyHedged.push(asset);
      } else if (exposure.hedgeRatio > 105) {
        overHedged.push(asset);
      } else if (exposure.hedgeRatio > 20) {
        partiallyHedged.push(asset);
      } else {
        unhedged.push(asset);
      }
    }

    return {
      perfectlyHedged,
      partiallyHedged,
      unhedged,
      overHedged,
    };
  }
}

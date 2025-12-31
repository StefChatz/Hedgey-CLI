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
    fundingRate: number;
    fundingRateAnnualized: number;
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
    aaveEquityUSD: number;
    hyperliquidTotalUSD: number;
    hyperliquidMarginUSD: number;
    totalCapitalUSD: number;
    netExposureUSD: number;
    overallHedgeRatio: number;
  };
  aaveNetAPY: number;
  hyperliquidFundingAPY: number;
  combinedNetAPY: number;
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

    const totals = this.calculateTotals(byAsset, aavePositions, hyperliquidPositions);
    const effectiveness = this.categorizeEffectiveness(byAsset);
    const aaveNetAPY = this.calculateAaveNetAPY(aavePositions);
    const hyperliquidFundingAPY = this.calculateHyperliquidFundingAPY(hyperliquidPositions);
    const combinedNetAPY = this.calculateCombinedNetAPY(aavePositions, hyperliquidPositions);

    return {
      byAsset,
      totals,
      aaveNetAPY,
      hyperliquidFundingAPY,
      combinedNetAPY,
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
        fundingRate: 0,
        fundingRateAnnualized: 0,
      };
    }

    return {
      size: position.size,
      sizeUSD: position.notionalValue,
      side: position.side,
      leverage: position.leverage,
      unrealizedPnl: position.unrealizedPnl,
      fundingRate: position.fundingRate,
      fundingRateAnnualized: position.fundingRateAnnualized,
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
      return (hyperliquidUSD / Math.abs(aaveUSD)) * 100;
    }

    if (aaveDirection === 'SHORT' && hyperliquidSide === 'LONG') {
      return (hyperliquidUSD / Math.abs(aaveUSD)) * 100;
    }

    return 0;
  }

  private calculateTotals(
    byAsset: Record<string, CombinedExposure>,
    aavePositions: Position[],
    hyperliquidPositions: HyperliquidPosition[]
  ) {
    let aaveTotalUSD = 0;
    let hyperliquidTotalUSD = 0;
    let netExposureUSD = 0;

    for (const exposure of Object.values(byAsset)) {
      aaveTotalUSD += Math.abs(exposure.aaveExposure.netUSD);
      hyperliquidTotalUSD += Math.abs(exposure.hyperliquidExposure.sizeUSD);
      netExposureUSD += exposure.netExposure.amountUSD;
    }

    let aaveSupplied = 0;
    let aaveBorrowed = 0;
    for (const pos of aavePositions) {
      aaveSupplied += pos.suppliedUSD;
      aaveBorrowed += pos.borrowedUSD;
    }
    const aaveEquityUSD = aaveSupplied - aaveBorrowed;

    let hyperliquidMarginUSD = 0;
    for (const pos of hyperliquidPositions) {
      hyperliquidMarginUSD += pos.leverage > 0 ? pos.notionalValue / pos.leverage : 0;
    }

    const totalCapitalUSD = aaveEquityUSD + hyperliquidMarginUSD;
    const overallHedgeRatio = aaveTotalUSD > 0 ? (hyperliquidTotalUSD / aaveTotalUSD) * 100 : 0;

    return {
      aaveTotalUSD,
      aaveEquityUSD,
      hyperliquidTotalUSD,
      hyperliquidMarginUSD,
      totalCapitalUSD,
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

  private calculateAaveNetAPY(positions: Position[]): number {
    let totalSuppliedUSD = 0;
    let totalBorrowedUSD = 0;
    let weightedSupplyAPY = 0;
    let weightedBorrowAPY = 0;

    for (const position of positions) {
      totalSuppliedUSD += position.suppliedUSD;
      totalBorrowedUSD += position.borrowedUSD;
      weightedSupplyAPY += position.suppliedUSD * position.supplyAPR;
      weightedBorrowAPY += position.borrowedUSD * position.borrowAPR;
    }

    if (totalSuppliedUSD === 0 && totalBorrowedUSD === 0) {
      return 0;
    }

    const netEquity = totalSuppliedUSD - totalBorrowedUSD;
    if (netEquity === 0) {
      return 0;
    }

    const totalSupplyIncome = weightedSupplyAPY / 100;
    const totalBorrowCost = weightedBorrowAPY / 100;
    const netIncome = totalSupplyIncome - totalBorrowCost;

    return (netIncome / netEquity) * 100;
  }

  private calculateHyperliquidFundingAPY(positions: HyperliquidPosition[]): number {
    let totalNotional = 0;
    let weightedFundingAPY = 0;

    for (const position of positions) {
      totalNotional += position.notionalValue;
      const effectiveFundingAPY =
        position.side === 'SHORT'
          ? position.fundingRateAnnualized
          : -position.fundingRateAnnualized;
      weightedFundingAPY += position.notionalValue * effectiveFundingAPY;
    }

    if (totalNotional === 0) {
      return 0;
    }

    return weightedFundingAPY / totalNotional;
  }

  private calculateCombinedNetAPY(
    aavePositions: Position[],
    hyperliquidPositions: HyperliquidPosition[]
  ): number {
    let aaveSuppliedUSD = 0;
    let aaveBorrowedUSD = 0;
    let weightedAaveAPY = 0;

    for (const position of aavePositions) {
      aaveSuppliedUSD += position.suppliedUSD;
      aaveBorrowedUSD += position.borrowedUSD;
      weightedAaveAPY +=
        position.suppliedUSD * position.supplyAPR - position.borrowedUSD * position.borrowAPR;
    }

    const aaveEquity = aaveSuppliedUSD - aaveBorrowedUSD;
    const aaveNetAPY = aaveEquity > 0 ? weightedAaveAPY / aaveEquity : 0;

    let hlNotional = 0;
    let weightedHLFunding = 0;
    for (const position of hyperliquidPositions) {
      const effectiveFunding =
        position.side === 'SHORT'
          ? position.fundingRateAnnualized
          : -position.fundingRateAnnualized;
      hlNotional += position.notionalValue;
      weightedHLFunding += position.notionalValue * effectiveFunding;
    }

    const totalCapital = aaveEquity + hlNotional;
    if (totalCapital <= 0) {
      return 0;
    }

    const weightedTotal = aaveEquity * aaveNetAPY + weightedHLFunding;
    return weightedTotal / totalCapital;
  }
}

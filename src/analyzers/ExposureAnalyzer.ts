import type { Analysis, Position } from '../types/position';

export class ExposureAnalyzer {
  analyze(positions: Position[]): Analysis {
    const byAsset = this.aggregateByAsset(positions);
    const totalSuppliedUSD = this.calculateTotalSupplied(positions);
    const totalBorrowedUSD = this.calculateTotalBorrowed(positions);
    const netValueUSD = totalSuppliedUSD - totalBorrowedUSD;
    const healthFactor = this.calculateHealthFactor(positions);
    const leverage = this.calculateLeverage(totalSuppliedUSD, netValueUSD);
    const utilizationRate = this.calculateUtilizationRate(totalBorrowedUSD, totalSuppliedUSD);
    const loops = this.detectLoops(positions);
    const netAPY = this.calculateNetAPY(positions, netValueUSD);

    return {
      totalSuppliedUSD,
      totalBorrowedUSD,
      netValueUSD,
      healthFactor,
      leverage,
      utilizationRate,
      netAPY,
      byAsset,
      loops,
    };
  }

  private aggregateByAsset(positions: Position[]): Analysis['byAsset'] {
    const aggregated: Record<string, any> = {};

    for (const position of positions) {
      if (!aggregated[position.asset]) {
        aggregated[position.asset] = {
          supplied: 0,
          borrowed: 0,
          suppliedUSD: 0,
          borrowedUSD: 0,
          net: 0,
          netUSD: 0,
          direction: 'NEUTRAL' as const,
        };
      }

      const asset = aggregated[position.asset];
      asset.supplied += position.supplied;
      asset.borrowed += position.borrowed;
      asset.suppliedUSD += position.suppliedUSD;
      asset.borrowedUSD += position.borrowedUSD;
    }

    for (const asset of Object.values(aggregated)) {
      asset.net = asset.supplied - asset.borrowed;
      asset.netUSD = asset.suppliedUSD - asset.borrowedUSD;
      asset.direction = asset.net > 0 ? 'LONG' : asset.net < 0 ? 'SHORT' : 'NEUTRAL';
    }

    return aggregated;
  }

  private calculateTotalSupplied(positions: Position[]): number {
    return positions.reduce((sum, position) => sum + position.suppliedUSD, 0);
  }

  private calculateTotalBorrowed(positions: Position[]): number {
    return positions.reduce((sum, position) => sum + position.borrowedUSD, 0);
  }

  private calculateHealthFactor(positions: Position[]): number {
    let totalCollateral = 0;
    let totalDebt = 0;

    for (const position of positions) {
      totalCollateral += position.suppliedUSD * position.liquidationThreshold;
      totalDebt += position.borrowedUSD;
    }

    if (totalDebt === 0) {
      return Infinity;
    }

    return totalCollateral / totalDebt;
  }

  private calculateLeverage(totalSuppliedUSD: number, netValueUSD: number): number {
    if (netValueUSD === 0) {
      return 1;
    }
    return totalSuppliedUSD / netValueUSD;
  }

  private calculateUtilizationRate(totalBorrowedUSD: number, totalSuppliedUSD: number): number {
    if (totalSuppliedUSD === 0) {
      return 0;
    }
    return (totalBorrowedUSD / totalSuppliedUSD) * 100;
  }

  private detectLoops(positions: Position[]): Analysis['loops'] {
    const assetMap = new Map<string, { supplied: number; borrowed: number }>();

    for (const position of positions) {
      const existing = assetMap.get(position.asset) || { supplied: 0, borrowed: 0 };
      existing.supplied += position.supplied;
      existing.borrowed += position.borrowed;
      assetMap.set(position.asset, existing);
    }

    const loops: Analysis['loops'] = [];

    for (const [asset, data] of assetMap.entries()) {
      if (data.supplied > 0 && data.borrowed > 0) {
        loops.push({
          asset,
          supplied: data.supplied,
          borrowed: data.borrowed,
          effectiveLeverage: data.supplied / (data.supplied - data.borrowed),
        });
      }
    }

    return loops;
  }

  private calculateNetAPY(positions: Position[], netValueUSD: number): number {
    if (netValueUSD === 0) {
      return 0;
    }

    let totalSupplyIncome = 0;
    let totalBorrowCost = 0;

    for (const position of positions) {
      totalSupplyIncome += position.suppliedUSD * (position.supplyAPR / 100);
      totalBorrowCost += position.borrowedUSD * (position.borrowAPR / 100);
    }

    const netIncome = totalSupplyIncome - totalBorrowCost;

    return (netIncome / netValueUSD) * 100;
  }
}

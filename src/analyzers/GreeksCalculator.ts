import type { Analysis, Position } from '../types/position';

export interface Greeks {
  delta: {
    totalDeltaUSD: number;
    byAsset: Record<string, { net: number; deltaUSD: number }>;
  };
  gamma: {
    leverage: number;
  };
  vega: {
    rateImpactMonthly: number;
    rateImpactYearly: number;
  };
  theta: {
    dailyNet: number;
    monthlyNet: number;
    yearlyNet: number;
  };
}

export class GreeksCalculator {
  calculate(positions: Position[], analysis: Analysis): Greeks {
    return {
      delta: this.calculateDelta(positions),
      gamma: this.calculateGamma(analysis.leverage),
      vega: this.calculateVega(positions),
      theta: this.calculateTheta(positions),
    };
  }

  private calculateDelta(positions: Position[]): Greeks['delta'] {
    let totalDeltaUSD = 0;
    const byAsset: Record<string, { net: number; deltaUSD: number }> = {};

    for (const position of positions) {
      const net = position.supplied - position.borrowed;
      const deltaUSD = net * position.price;
      totalDeltaUSD += deltaUSD;

      if (!byAsset[position.asset]) {
        byAsset[position.asset] = { net: 0, deltaUSD: 0 };
      }

      byAsset[position.asset].net += net;
      byAsset[position.asset].deltaUSD += deltaUSD;
    }

    return { totalDeltaUSD, byAsset };
  }

  private calculateGamma(leverage: number): Greeks['gamma'] {
    return { leverage };
  }

  private calculateVega(positions: Position[]): Greeks['vega'] {
    const totalBorrowedUSD = positions.reduce((sum, position) => sum + position.borrowedUSD, 0);

    const RATE_INCREASE_PERCENT = 0.01;
    const rateImpactYearly = totalBorrowedUSD * RATE_INCREASE_PERCENT;
    const rateImpactMonthly = rateImpactYearly / 12;

    return { rateImpactMonthly, rateImpactYearly };
  }

  private calculateTheta(positions: Position[]): Greeks['theta'] {
    let dailySupplyInterest = 0;
    let dailyBorrowInterest = 0;

    const DAYS_PER_YEAR = 365;
    const PERCENT_TO_DECIMAL = 100;

    for (const position of positions) {
      dailySupplyInterest +=
        (position.suppliedUSD * position.supplyAPR) / DAYS_PER_YEAR / PERCENT_TO_DECIMAL;
      dailyBorrowInterest +=
        (position.borrowedUSD * position.borrowAPR) / DAYS_PER_YEAR / PERCENT_TO_DECIMAL;
    }

    const dailyNet = dailySupplyInterest - dailyBorrowInterest;

    return {
      dailyNet,
      monthlyNet: dailyNet * 30,
      yearlyNet: dailyNet * DAYS_PER_YEAR,
    };
  }
}

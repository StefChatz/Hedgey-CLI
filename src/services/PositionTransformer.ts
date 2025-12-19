import { formatUnits } from 'viem';
import type { Chain } from '../config/chains';
import type { Position } from '../types/position';

const RAY = 10n ** 27n;
const SECONDS_PER_YEAR = 31536000n;

interface RawUserReserveData {
  symbol: string;
  name: string;
  decimals: number;
  currentATokenBalance: bigint;
  currentVariableDebt: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  liquidationThreshold: number;
  liquidationBonus: number;
}

export class PositionTransformer {
  transform(
    rawReserves: RawUserReserveData[],
    chain: Chain,
    prices: Record<string, number>
  ): Position[] {
    return rawReserves.map(reserve => this.transformReserve(reserve, chain, prices));
  }

  private transformReserve(
    reserve: RawUserReserveData,
    chain: Chain,
    prices: Record<string, number>
  ): Position {
    const supplied = parseFloat(formatUnits(reserve.currentATokenBalance, reserve.decimals));
    const borrowed = parseFloat(formatUnits(reserve.currentVariableDebt, reserve.decimals));
    const price = prices[reserve.symbol] || 0;

    return {
      chain,
      asset: reserve.symbol,
      name: reserve.name,
      supplied,
      borrowed,
      suppliedUSD: supplied * price,
      borrowedUSD: borrowed * price,
      netUSD: (supplied - borrowed) * price,
      supplyAPR: this.convertRayToAPR(reserve.liquidityRate),
      borrowAPR: this.convertRayToAPR(reserve.variableBorrowRate),
      liquidationThreshold: reserve.liquidationThreshold,
      liquidationBonus: reserve.liquidationBonus,
      price,
      decimals: reserve.decimals,
    };
  }

  private convertRayToAPR(rayRate: bigint): number {
    const apr = (rayRate * SECONDS_PER_YEAR * 100n) / RAY;
    return parseFloat(apr.toString()) / 100;
  }
}

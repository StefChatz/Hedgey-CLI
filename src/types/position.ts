import { z } from 'zod';

export const RawPositionSchema = z.object({
  reserve: z.object({
    symbol: z.string(),
    name: z.string(),
    decimals: z.string(),
    liquidationThreshold: z.string(),
    reserveLiquidationBonus: z.string(),
  }),
  currentATokenBalance: z.string(),
  currentTotalDebt: z.string(),
  liquidityRate: z.string(),
  variableBorrowRate: z.string(),
});

export const PositionSchema = z.object({
  chain: z.string(),
  asset: z.string(),
  name: z.string(),
  supplied: z.number().nonnegative(),
  borrowed: z.number().nonnegative(),
  suppliedUSD: z.number().nonnegative(),
  borrowedUSD: z.number().nonnegative(),
  netUSD: z.number(),
  supplyAPR: z.number(),
  borrowAPR: z.number(),
  liquidationThreshold: z.number(),
  liquidationBonus: z.number(),
  price: z.number().nonnegative(),
  decimals: z.number(),
});

export const AnalysisSchema = z.object({
  totalSuppliedUSD: z.number(),
  totalBorrowedUSD: z.number(),
  netValueUSD: z.number(),
  healthFactor: z.number().positive(),
  leverage: z.number().positive(),
  utilizationRate: z.number(),
  byAsset: z.record(
    z.string(),
    z.object({
      supplied: z.number(),
      borrowed: z.number(),
      suppliedUSD: z.number(),
      borrowedUSD: z.number(),
      net: z.number(),
      netUSD: z.number(),
      direction: z.enum(['LONG', 'SHORT', 'NEUTRAL']),
    })
  ),
  loops: z.array(
    z.object({
      asset: z.string(),
      supplied: z.number(),
      borrowed: z.number(),
      effectiveLeverage: z.number(),
    })
  ),
});

export type RawPosition = z.infer<typeof RawPositionSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

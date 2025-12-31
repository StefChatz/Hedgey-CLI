import ky from 'ky';
import { createPublicClient, http, type Address } from 'viem';
import { ERC20_ABI, POOL_ABI, POOL_DATA_PROVIDER_ABI } from '../config/abis';
import { CHAIN_CONFIG, type Chain } from '../config/chains';

const AAVE_SUBGRAPH_URLS: Record<Chain, string> = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  polygon: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  optimism: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  base: 'https://api.goldsky.com/api/public/project_clk74pd7lueg738tw9sjh79d6/subgraphs/aave-v3-base/1.0.0/gn',
};

interface RawUserReserveData {
  reserveAddress: Address;
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

export class AaveService {
  private client;
  private config;
  private chain: Chain;
  private ratesCache: Map<string, { supplyRate: number; borrowRate: number }> = new Map();

  constructor(chain: Chain) {
    this.chain = chain;
    this.config = CHAIN_CONFIG[chain];

    if (!this.config.alchemyKey) {
      throw new Error(
        `Missing Alchemy API key for ${chain}. Set ALCHEMY_${chain.toUpperCase()}_KEY in .env`
      );
    }

    this.client = createPublicClient({
      chain: this.config.viemChain,
      transport: http(this.config.rpcUrl),
    });
  }

  private async fetchRatesFromSubgraph(): Promise<void> {
    const subgraphUrl = AAVE_SUBGRAPH_URLS[this.chain];
    if (!subgraphUrl) return;

    try {
      const query = `{
        reserves {
          underlyingAsset
          liquidityRate
          variableBorrowRate
        }
      }`;

      const response = await ky
        .post(subgraphUrl, {
          json: { query },
          timeout: 10000,
        })
        .json<{
          data: {
            reserves: Array<{
              underlyingAsset: string;
              liquidityRate: string;
              variableBorrowRate: string;
            }>;
          };
        }>();

      for (const reserve of response.data.reserves) {
        const address = reserve.underlyingAsset.toLowerCase();
        const supplyRate = Number(BigInt(reserve.liquidityRate)) / 1e27;
        const borrowRate = Number(BigInt(reserve.variableBorrowRate)) / 1e27;
        this.ratesCache.set(address, { supplyRate, borrowRate });
      }
    } catch {
      console.warn('Failed to fetch rates from Aave subgraph');
    }
  }

  async getUserReserveData(userAddress: Address): Promise<RawUserReserveData[]> {
    await this.fetchRatesFromSubgraph();
    const reserves = await this.getReservesList();
    const userReserves: RawUserReserveData[] = [];

    for (const reserveAddress of reserves) {
      try {
        const [userData, reserveConfig, tokenMetadata] = await Promise.all([
          this.getUserReserveDataForAsset(reserveAddress, userAddress),
          this.getReserveConfigurationData(reserveAddress),
          this.getTokenMetadata(reserveAddress),
        ]);

        const hasPosition = userData.currentATokenBalance > 0n || userData.currentVariableDebt > 0n;

        if (hasPosition) {
          userReserves.push({
            reserveAddress,
            symbol: tokenMetadata.symbol,
            name: tokenMetadata.name,
            decimals: tokenMetadata.decimals,
            currentATokenBalance: userData.currentATokenBalance,
            currentVariableDebt: userData.currentVariableDebt,
            liquidityRate: userData.liquidityRate,
            variableBorrowRate: userData.variableBorrowRate,
            liquidationThreshold: reserveConfig.liquidationThreshold,
            liquidationBonus: reserveConfig.liquidationBonus,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch data for reserve ${reserveAddress}:`, error);
        continue;
      }
    }

    return userReserves;
  }

  private async getReservesList(): Promise<Address[]> {
    const reserves = await this.client.readContract({
      address: this.config.poolAddress,
      abi: POOL_ABI,
      functionName: 'getReservesList',
    });
    const reservesAddresses = reserves.map((reserve: Address) => reserve.toLowerCase() as Address);

    return reservesAddresses;
  }

  private async getUserReserveDataForAsset(
    asset: Address,
    user: Address
  ): Promise<{
    currentATokenBalance: bigint;
    currentVariableDebt: bigint;
    liquidityRate: bigint;
    variableBorrowRate: bigint;
  }> {
    const [userData, reserveData] = await Promise.all([
      this.client.readContract({
        address: this.config.poolDataProvider,
        abi: POOL_DATA_PROVIDER_ABI,
        functionName: 'getUserReserveData',
        args: [asset, user],
      }),
      this.client.readContract({
        address: this.config.poolDataProvider,
        abi: POOL_DATA_PROVIDER_ABI,
        functionName: 'getReserveData',
        args: [asset],
      }),
    ]);

    const cachedRates = this.ratesCache.get(asset.toLowerCase());
    const supplyRate = cachedRates?.supplyRate ?? 0.01;
    const borrowRate = cachedRates?.borrowRate ?? 0.02;
    const supplyRateRay = BigInt(Math.floor(supplyRate * 1e27));
    const borrowRateRay = BigInt(Math.floor(borrowRate * 1e27));

    return {
      currentATokenBalance: userData[0],
      currentVariableDebt: userData[2],
      liquidityRate: supplyRateRay,
      variableBorrowRate: borrowRateRay,
    };
  }

  private async getReserveConfigurationData(
    asset: Address
  ): Promise<{ liquidationThreshold: number; liquidationBonus: number }> {
    const config = await this.client.readContract({
      address: this.config.poolDataProvider,
      abi: POOL_DATA_PROVIDER_ABI,
      functionName: 'getReserveConfigurationData',
      args: [asset],
    });

    return {
      liquidationThreshold: Number(config[2]) / 10000,
      liquidationBonus: Number(config[3]) / 10000,
    };
  }

  private async getTokenMetadata(
    token: Address
  ): Promise<{ symbol: string; decimals: number; name: string }> {
    const [symbol, decimals, name] = await Promise.all([
      this.client.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      this.client.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      this.client.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
    ]);

    return {
      symbol: symbol as string,
      decimals: Number(decimals),
      name: name as string,
    };
  }
}

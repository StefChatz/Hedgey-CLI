import { createPublicClient, http, type Address } from 'viem';
import { ERC20_ABI, POOL_ABI, POOL_DATA_PROVIDER_ABI } from '../config/abis';
import { CHAIN_CONFIG, type Chain } from '../config/chains';

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

  constructor(chain: Chain) {
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

  async getUserReserveData(userAddress: Address): Promise<RawUserReserveData[]> {
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

    return {
      currentATokenBalance: userData[0],
      currentVariableDebt: userData[2],
      liquidityRate: reserveData[3],
      variableBorrowRate: reserveData[4],
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

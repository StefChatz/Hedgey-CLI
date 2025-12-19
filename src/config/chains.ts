import dotenv from 'dotenv';
import type { Chain as ViemChain } from 'viem';
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains';

dotenv.config();

export type Chain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';

interface ChainConfig {
  viemChain: ViemChain;
  alchemyKey: string;
  rpcUrl: string;
  poolAddress: `0x${string}`;
  poolDataProvider: `0x${string}`;
}

const ALCHEMY_KEYS = {
  ethereum: process.env.ALCHEMY_ETHEREUM_KEY || '',
  polygon: process.env.ALCHEMY_POLYGON_KEY || '',
  arbitrum: process.env.ALCHEMY_ARBITRUM_KEY || '',
  optimism: process.env.ALCHEMY_OPTIMISM_KEY || '',
  base: process.env.ALCHEMY_BASE_KEY || '',
};

export const CHAIN_CONFIG: Record<Chain, ChainConfig> = {
  ethereum: {
    viemChain: mainnet,
    alchemyKey: ALCHEMY_KEYS.ethereum,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEYS.ethereum}`,
    poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    poolDataProvider: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
  },
  polygon: {
    viemChain: polygon,
    alchemyKey: ALCHEMY_KEYS.polygon,
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEYS.polygon}`,
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    poolDataProvider: '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654',
  },
  arbitrum: {
    viemChain: arbitrum,
    alchemyKey: ALCHEMY_KEYS.arbitrum,
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEYS.arbitrum}`,
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    poolDataProvider: '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654',
  },
  optimism: {
    viemChain: optimism,
    alchemyKey: ALCHEMY_KEYS.optimism,
    rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEYS.optimism}`,
    poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    poolDataProvider: '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654',
  },
  base: {
    viemChain: base,
    alchemyKey: ALCHEMY_KEYS.base,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEYS.base}`,
    poolAddress: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    poolDataProvider: '0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac',
  },
};

export const CHAINS: Chain[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];

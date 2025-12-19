import chalk from 'chalk';
import { isAddress } from 'viem';
import { CHAINS, type Chain } from '../config/chains';

export function validateAddress(address: string): string {
  if (!isAddress(address)) {
    console.error(chalk.red('✗ Invalid Ethereum address'));
    console.error(chalk.gray('Expected format: 0x followed by 40 hex characters'));
    console.error(chalk.gray('Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'));
    process.exit(1);
  }
  return address.toLowerCase();
}

export function validateChain(chain: string): Chain {
  if (!CHAINS.includes(chain as Chain)) {
    console.error(chalk.red(`✗ Unsupported chain: ${chain}`));
    console.error(chalk.gray(`Supported chains: ${CHAINS.join(', ')}`));
    process.exit(1);
  }
  return chain as Chain;
}

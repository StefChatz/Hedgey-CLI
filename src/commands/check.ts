import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { Address } from 'viem';
import { ExposureAnalyzer } from '../analyzers/ExposureAnalyzer';
import { TableFormatter } from '../formatters/TableFormatter';
import { AaveService } from '../services/AaveService';
import { PositionTransformer } from '../services/PositionTransformer';
import { PriceService } from '../services/PriceService';
import { validateAddress, validateChain } from '../utils/validators';

interface CheckOptions {
  chain?: string;
  allChains?: boolean;
}

export async function checkCommand(address: string, options: CheckOptions): Promise<void> {
  intro(chalk.cyan('🦔 Hedgey Check'));

  const validAddress = validateAddress(address) as Address;
  const chain = validateChain(options.chain || 'ethereum');

  const spinnerInstance = spinner();
  spinnerInstance.start('Connecting to Alchemy...');

  try {
    spinnerInstance.message('Fetching Aave positions...');
    const aaveService = new AaveService(chain);
    const rawReserves = await aaveService.getUserReserveData(validAddress);

    if (rawReserves.length === 0) {
      spinnerInstance.stop('No positions found');
      outro(chalk.gray(`This address has no Aave positions on ${chain}`));
      return;
    }

    spinnerInstance.message('Fetching prices...');
    const priceService = new PriceService();
    const symbols = rawReserves.map(r => r.symbol);
    const prices = await priceService.getPrices(symbols);

    spinnerInstance.message('Calculating metrics...');
    const transformer = new PositionTransformer();
    const positions = transformer.transform(rawReserves, chain, prices);

    const analyzer = new ExposureAnalyzer();
    const analysis = analyzer.analyze(positions);

    spinnerInstance.stop(chalk.green(`Analyzed ${positions.length} positions on ${chain}`));

    const formatter = new TableFormatter();
    console.log(formatter.formatSummary(analysis));
    console.log('\n' + formatter.formatPositionsTable(analysis.byAsset));

    if (analysis.loops.length > 0) {
      console.log(formatter.formatLoops(analysis.loops));
    }

    outro(chalk.green('Stay sharp! 🦔'));
  } catch (error) {
    spinnerInstance.stop('Failed');
    if (error instanceof Error) {
      outro(chalk.red(`Error: ${error.message}`));
    } else {
      outro(chalk.red('An unknown error occurred'));
    }
    process.exit(1);
  }
}

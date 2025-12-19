import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { Address } from 'viem';
import { ExposureAnalyzer } from '../analyzers/ExposureAnalyzer';
import { GreeksCalculator } from '../analyzers/GreeksCalculator';
import { GreeksFormatter } from '../formatters/GreeksFormatter';
import { TableFormatter } from '../formatters/TableFormatter';
import { AaveService } from '../services/AaveService';
import { PositionTransformer } from '../services/PositionTransformer';
import { PriceService } from '../services/PriceService';
import { validateAddress, validateChain } from '../utils/validators';

interface GreeksOptions {
  chain?: string;
}

export async function greeksCommand(address: string, options: GreeksOptions): Promise<void> {
  intro(chalk.cyan('🦔 Hedgey Greeks'));

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
      outro(chalk.gray('This address has no Aave positions'));
      return;
    }

    spinnerInstance.message('Fetching prices...');
    const priceService = new PriceService();
    const symbols = rawReserves.map(r => r.symbol);
    const prices = await priceService.getPrices(symbols);

    spinnerInstance.message('Calculating Greeks...');
    const transformer = new PositionTransformer();
    const positions = transformer.transform(rawReserves, chain, prices);

    const analyzer = new ExposureAnalyzer();
    const analysis = analyzer.analyze(positions);

    const calculator = new GreeksCalculator();
    const greeks = calculator.calculate(positions, analysis);

    spinnerInstance.stop(chalk.green('Analysis complete'));

    const tableFormatter = new TableFormatter();
    const greeksFormatter = new GreeksFormatter();

    console.log(tableFormatter.formatSummary(analysis));
    console.log(greeksFormatter.format(greeks));

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

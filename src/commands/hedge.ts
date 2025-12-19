import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { Address } from 'viem';
import { HedgeAnalyzer } from '../analyzers/HedgeAnalyzer';
import { HedgeFormatter } from '../formatters/HedgeFormatter';
import { AaveService } from '../services/AaveService';
import { HyperliquidService } from '../services/HyperliquidService';
import { PositionTransformer } from '../services/PositionTransformer';
import { PriceService } from '../services/PriceService';
import { validateAddress, validateChain } from '../utils/validators';

interface HedgeOptions {
  chain?: string;
}

export async function hedgeCommand(address: string, options: HedgeOptions): Promise<void> {
  intro(chalk.cyan('🦔 Hedgey Hedge Analysis'));

  const validAddress = validateAddress(address) as Address;
  const chain = validateChain(options.chain || 'ethereum');

  const spinnerInstance = spinner();

  try {
    spinnerInstance.start('Fetching Aave positions...');
    const aaveService = new AaveService(chain);
    const rawAaveReserves = await aaveService.getUserReserveData(validAddress);

    spinnerInstance.message('Fetching Hyperliquid positions...');
    const hyperliquidService = new HyperliquidService();
    const hyperliquidPositions = await hyperliquidService.getUserPositions(validAddress);

    if (rawAaveReserves.length === 0 && hyperliquidPositions.length === 0) {
      spinnerInstance.stop('No positions found');
      outro(chalk.gray('This address has no positions on Aave or Hyperliquid'));
      return;
    }

    spinnerInstance.message('Fetching prices...');
    const priceService = new PriceService();

    const aaveSymbols = rawAaveReserves.map(r => r.symbol);
    const hlSymbols = hyperliquidPositions.map(p => p.coin);
    const allSymbols = [...new Set([...aaveSymbols, ...hlSymbols])];

    const prices = await priceService.getPrices(allSymbols);

    const hlPrices = await hyperliquidService.getMarkPrices();
    for (const [coin, price] of Object.entries(hlPrices)) {
      if (!prices[coin]) {
        prices[coin] = price;
      }
    }

    spinnerInstance.message('Analyzing hedge effectiveness...');
    const transformer = new PositionTransformer();
    const aavePositions = transformer.transform(rawAaveReserves, chain, prices);

    const analyzer = new HedgeAnalyzer();
    const hedgeAnalysis = analyzer.analyze(aavePositions, hyperliquidPositions, prices);

    spinnerInstance.stop(
      chalk.green(
        `Analyzed ${aavePositions.length} Aave + ${hyperliquidPositions.length} Hyperliquid positions`
      )
    );

    const formatter = new HedgeFormatter();
    console.log(formatter.format(hedgeAnalysis));

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

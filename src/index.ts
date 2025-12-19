#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { checkCommand } from './commands/check';
import { greeksCommand } from './commands/greeks';
import { hedgeCommand } from './commands/hedge';

const program = new Command();

program
  .name('hedgey')
  .description(chalk.cyan('🦔 Your DeFi hedging companion - Analyze Aave positions'))
  .version('1.0.0');

program
  .command('check')
  .description('Check Aave positions and health')
  .argument('<address>', 'Wallet address (0x...)')
  .option('-c, --chain <chain>', 'Chain (ethereum, polygon, arbitrum, optimism)', 'ethereum')
  .option('-a, --all-chains', 'Check all chains')
  .action(checkCommand);

program
  .command('greeks')
  .description('Show position Greeks (delta, gamma, vega, theta)')
  .argument('<address>', 'Wallet address (0x...)')
  .option('-c, --chain <chain>', 'Chain', 'ethereum')
  .action(greeksCommand);

program
  .command('hedge')
  .description('Analyze hedge effectiveness (Aave + Hyperliquid)')
  .argument('<address>', 'Wallet address (0x...)')
  .option('-c, --chain <chain>', 'Aave chain', 'ethereum')
  .action(hedgeCommand);

program.parse();

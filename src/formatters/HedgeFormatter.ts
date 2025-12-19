import chalk from 'chalk';
import Table from 'cli-table3';
import type { HedgeAnalysis } from '../analyzers/HedgeAnalyzer';

export class HedgeFormatter {
  format(analysis: HedgeAnalysis): string {
    let output = '';

    output += this.formatHeader();
    output += this.formatPositionsTable(analysis);
    output += this.formatTotals(analysis.totals);
    output += this.formatEffectiveness(analysis.effectiveness);

    return output;
  }

  private formatHeader(): string {
    return `
${chalk.bold.underline('HEDGE ANALYSIS (Aave + Hyperliquid)')}
${'═'.repeat(80)}
`;
  }

  private formatPositionsTable(analysis: HedgeAnalysis): string {
    const table = new Table({
      head: [
        chalk.bold('Asset'),
        chalk.bold('Aave'),
        chalk.bold('Hyperliquid'),
        chalk.bold('Net'),
        chalk.bold('Hedge %'),
      ],
      colWidths: [10, 20, 20, 20, 12],
    });

    for (const [asset, exposure] of Object.entries(analysis.byAsset)) {
      if (exposure.aaveExposure.netUSD === 0 && exposure.hyperliquidExposure.sizeUSD === 0) {
        continue;
      }

      const aaveCell = this.formatExposure(
        exposure.aaveExposure.net,
        exposure.aaveExposure.netUSD,
        exposure.aaveExposure.direction
      );

      const hlCell = this.formatHyperliquid(
        exposure.hyperliquidExposure.size,
        exposure.hyperliquidExposure.sizeUSD,
        exposure.hyperliquidExposure.side,
        exposure.hyperliquidExposure.leverage
      );

      const netCell = this.formatExposure(
        exposure.netExposure.amount,
        exposure.netExposure.amountUSD,
        exposure.netExposure.direction
      );

      const hedgeCell = this.formatHedgeRatio(exposure.hedgeRatio);

      table.push([asset, aaveCell, hlCell, netCell, hedgeCell]);
    }

    return '\n' + table.toString() + '\n';
  }

  private formatExposure(amount: number, amountUSD: number, direction: string): string {
    if (amount === 0) return chalk.gray('--');

    const color = direction === 'LONG' ? chalk.green : chalk.red;
    const sign = amount > 0 ? '+' : '';

    return color(
      `${sign}${Math.abs(amount).toFixed(4)}\n${direction}\n$${Math.abs(amountUSD).toLocaleString()}`
    );
  }

  private formatHyperliquid(size: number, sizeUSD: number, side: string, leverage: number): string {
    if (size === 0) return chalk.gray('--');

    const color = side === 'LONG' ? chalk.green : side === 'SHORT' ? chalk.red : chalk.gray;
    const sign = side === 'SHORT' ? '-' : '+';

    return color(`${sign}${size.toFixed(4)}\n${side} ${leverage}x\n$${sizeUSD.toLocaleString()}`);
  }

  private formatHedgeRatio(ratio: number): string {
    if (ratio === 0) return chalk.gray('0%');
    if (ratio >= 95 && ratio <= 105) return chalk.green.bold(`${ratio.toFixed(0)}% ✓`);
    if (ratio > 105) return chalk.yellow(`${ratio.toFixed(0)}% ⚠️`);
    if (ratio >= 50) return chalk.yellow(`${ratio.toFixed(0)}%`);
    return chalk.red(`${ratio.toFixed(0)}%`);
  }

  private formatTotals(totals: HedgeAnalysis['totals']): string {
    return `
${chalk.bold.underline('TOTALS')}
${'─'.repeat(80)}

${chalk.bold('Aave Exposure:')}        $${chalk.cyan(totals.aaveTotalUSD.toLocaleString())}
${chalk.bold('Hyperliquid Hedge:')}    $${chalk.magenta(totals.hyperliquidTotalUSD.toLocaleString())}
${chalk.bold('Net Exposure:')}         $${chalk.yellow(totals.netExposureUSD.toLocaleString())}
${chalk.bold('Overall Hedge Ratio:')} ${this.formatHedgeRatio(totals.overallHedgeRatio)}
`;
  }

  private formatEffectiveness(effectiveness: HedgeAnalysis['effectiveness']): string {
    let output = `
${chalk.bold.underline('HEDGE EFFECTIVENESS')}
${'─'.repeat(80)}
`;

    if (effectiveness.perfectlyHedged.length > 0) {
      output += `\n${chalk.green('✓ Perfectly Hedged (95-105%):')} ${effectiveness.perfectlyHedged.join(', ')}`;
    }

    if (effectiveness.partiallyHedged.length > 0) {
      output += `\n${chalk.yellow('⚠ Partially Hedged (20-95%):')} ${effectiveness.partiallyHedged.join(', ')}`;
    }

    if (effectiveness.unhedged.length > 0) {
      output += `\n${chalk.red('✗ Unhedged (<20%):')} ${effectiveness.unhedged.join(', ')}`;
    }

    if (effectiveness.overHedged.length > 0) {
      output += `\n${chalk.yellow('⚠ Over-Hedged (>105%):')} ${effectiveness.overHedged.join(', ')}`;
    }

    return output + '\n';
  }
}

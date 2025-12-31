import chalk from 'chalk';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import type { HedgeAnalysis } from '../analyzers/HedgeAnalyzer';

export class HedgeFormatter {
  format(analysis: HedgeAnalysis): string {
    let output = '';

    output += this.formatHeader();
    output += this.formatPositionsTable(analysis);
    output += this.formatTotals(analysis);
    output += this.formatAPYSummary(analysis);
    output += this.formatEffectiveness(analysis.effectiveness);

    return output;
  }

  private formatHeader(): string {
    return `
${chalk.bold.cyan('═'.repeat(80))}
${chalk.bold.cyan('                      HEDGE ANALYSIS (Aave + Hyperliquid)')}
${chalk.bold.cyan('═'.repeat(80))}
`;
  }

  private formatPositionsTable(analysis: HedgeAnalysis): string {
    const table = new Table({
      head: [
        chalk.bold('Asset'),
        chalk.bold('Aave Position'),
        chalk.bold('Hyperliquid Position'),
        chalk.bold('Net Exposure'),
        chalk.bold('Hedge %'),
      ],
      colWidths: [10, 22, 24, 20, 14],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
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
        exposure.hyperliquidExposure.leverage,
        exposure.hyperliquidExposure.fundingRateAnnualized
      );

      const netCell = this.formatExposure(
        exposure.netExposure.amount,
        exposure.netExposure.amountUSD,
        exposure.netExposure.direction
      );

      const hedgeCell = this.formatHedgeRatio(exposure.hedgeRatio);

      table.push([asset, aaveCell, hlCell, netCell, hedgeCell]);
    }

    return '\n' + table.toString() + '\n\n';
  }

  private formatExposure(amount: number, amountUSD: number, direction: string): string {
    if (amount === 0) return chalk.gray('--');

    const color = direction === 'LONG' ? chalk.green : chalk.red;
    const sign = amount > 0 ? '+' : '';

    return color(
      `${sign}${Math.abs(amount).toFixed(4)}\n${direction}\n$${Math.abs(amountUSD).toLocaleString()}`
    );
  }

  private formatHyperliquid(
    size: number,
    sizeUSD: number,
    side: string,
    leverage: number,
    fundingRateAnnualized: number
  ): string {
    if (size === 0) return chalk.gray('--');

    const color = side === 'LONG' ? chalk.green : side === 'SHORT' ? chalk.red : chalk.gray;
    const sign = side === 'SHORT' ? '-' : '+';
    const fundingSign = fundingRateAnnualized >= 0 ? '+' : '';
    const fundingColor = fundingRateAnnualized >= 0 ? chalk.green : chalk.red;

    return color(
      `${sign}${size.toFixed(4)}\n${side} ${leverage}x\n$${sizeUSD.toLocaleString()}\n${fundingColor(`${fundingSign}${fundingRateAnnualized.toFixed(2)}% APY`)}`
    );
  }

  private formatHedgeRatio(ratio: number): string {
    if (ratio === 0) return chalk.gray('0%');
    if (ratio >= 95 && ratio <= 105) return chalk.green.bold(`${ratio.toFixed(0)}% ✓`);
    if (ratio > 105) return chalk.yellow(`${ratio.toFixed(0)}% ⚠️`);
    if (ratio >= 50) return chalk.yellow(`${ratio.toFixed(0)}%`);
    return chalk.red(`${ratio.toFixed(0)}%`);
  }

  private formatTotals(analysis: HedgeAnalysis): string {
    const { totals } = analysis;
    const netSign = totals.netExposureUSD >= 0 ? '' : '-';
    const netColor = totals.netExposureUSD >= 0 ? chalk.green : chalk.red;
    const netDirection =
      totals.netExposureUSD > 0 ? ' (LONG)' : totals.netExposureUSD < 0 ? ' (SHORT)' : '';

    return `${chalk.bold.cyan('─'.repeat(80))}
${chalk.bold.cyan('                              PORTFOLIO TOTALS')}
${chalk.bold.cyan('─'.repeat(80))}

  ${chalk.bold('Aave Exposure:')}          ${chalk.cyan('$' + totals.aaveTotalUSD.toFixed(2))}
  ${chalk.bold('Aave Equity:')}            ${chalk.cyan('$' + totals.aaveEquityUSD.toFixed(2))}
  ${chalk.bold('HL Notional:')}            ${chalk.magenta('$' + totals.hyperliquidTotalUSD.toFixed(2))}
  ${chalk.bold('HL Margin:')}              ${chalk.magenta('$' + totals.hyperliquidMarginUSD.toFixed(2))}
  ${chalk.bold('Total Capital:')}          ${chalk.yellow('$' + totals.totalCapitalUSD.toFixed(2))}
  ${chalk.bold('Net Exposure:')}           ${netColor(netSign + '$' + Math.abs(totals.netExposureUSD).toFixed(2) + netDirection)}
  ${chalk.bold('Hedge Ratio:')}            ${this.formatHedgeRatio(totals.overallHedgeRatio)}

`;
  }

  private formatAPYSummary(analysis: HedgeAnalysis): string {
    const formatAPY = (apy: number): string => {
      const sign = apy >= 0 ? '+' : '';
      const color = apy >= 0 ? chalk.green : chalk.red;
      return color(`${sign}${apy.toFixed(2)}%`);
    };

    return `${chalk.bold.cyan('─'.repeat(80))}
${chalk.bold.cyan('                              APY BREAKDOWN')}
${chalk.bold.cyan('─'.repeat(80))}

  ${chalk.bold('Aave Net APY:')}           ${formatAPY(analysis.aaveNetAPY)} ${chalk.gray('(on Aave equity)')}
  ${chalk.bold('HL Funding APY:')}         ${formatAPY(analysis.hyperliquidFundingAPY)} ${chalk.gray('(on HL notional)')}
  ${chalk.bold('Combined Net APY:')}       ${formatAPY(analysis.combinedNetAPY)} ${chalk.gray('(on total capital)')}

`;
  }

  private formatEffectiveness(effectiveness: HedgeAnalysis['effectiveness']): string {
    let output = `${chalk.bold.cyan('─'.repeat(80))}
${chalk.bold.cyan('                           HEDGE EFFECTIVENESS')}
${chalk.bold.cyan('─'.repeat(80))}

`;

    if (effectiveness.perfectlyHedged.length > 0) {
      output += `  ${chalk.green.bold('✓ Perfectly Hedged (95-105%):')} ${chalk.green(effectiveness.perfectlyHedged.join(', '))}\n`;
    }

    if (effectiveness.partiallyHedged.length > 0) {
      output += `  ${chalk.yellow.bold('⚠ Partially Hedged (20-95%):')} ${chalk.yellow(effectiveness.partiallyHedged.join(', '))}\n`;
    }

    if (effectiveness.unhedged.length > 0) {
      output += `  ${chalk.red.bold('✗ Unhedged (<20%):')} ${chalk.red(effectiveness.unhedged.join(', '))}\n`;
    }

    if (effectiveness.overHedged.length > 0) {
      output += `  ${chalk.yellow.bold('⚠ Over-Hedged (>105%):')} ${chalk.yellow(effectiveness.overHedged.join(', '))}\n`;
    }

    if (
      effectiveness.perfectlyHedged.length === 0 &&
      effectiveness.partiallyHedged.length === 0 &&
      effectiveness.unhedged.length === 0 &&
      effectiveness.overHedged.length === 0
    ) {
      output += `  ${chalk.gray('No active hedges found')}\n`;
    }

    return output + '\n';
  }

  exportToCSV(analysis: HedgeAnalysis, address: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const filename = `hedge-analysis_${shortAddress}_${timestamp}.csv`;

    const rows: string[] = [];
    rows.push('HEDGE ANALYSIS - POSITIONS');
    rows.push(
      'Asset,Aave Amount,Aave USD,Aave Direction,HL Amount,HL USD,HL Side,HL Leverage,HL Funding APY,Net Amount,Net USD,Net Direction,Hedge Ratio %'
    );

    for (const [asset, exposure] of Object.entries(analysis.byAsset)) {
      if (exposure.aaveExposure.netUSD === 0 && exposure.hyperliquidExposure.sizeUSD === 0) {
        continue;
      }

      rows.push(
        [
          asset,
          exposure.aaveExposure.net.toFixed(6),
          exposure.aaveExposure.netUSD.toFixed(2),
          exposure.aaveExposure.direction,
          exposure.hyperliquidExposure.size.toFixed(6),
          exposure.hyperliquidExposure.sizeUSD.toFixed(2),
          exposure.hyperliquidExposure.side,
          exposure.hyperliquidExposure.leverage.toFixed(1),
          exposure.hyperliquidExposure.fundingRateAnnualized.toFixed(2),
          exposure.netExposure.amount.toFixed(6),
          exposure.netExposure.amountUSD.toFixed(2),
          exposure.netExposure.direction,
          exposure.hedgeRatio.toFixed(2),
        ].join(',')
      );
    }

    rows.push('');
    rows.push('PORTFOLIO TOTALS');
    rows.push('Metric,Value');
    rows.push(`Aave Exposure USD,${analysis.totals.aaveTotalUSD.toFixed(2)}`);
    rows.push(`Aave Equity USD,${analysis.totals.aaveEquityUSD.toFixed(2)}`);
    rows.push(`Hyperliquid Notional USD,${analysis.totals.hyperliquidTotalUSD.toFixed(2)}`);
    rows.push(`Hyperliquid Margin USD,${analysis.totals.hyperliquidMarginUSD.toFixed(2)}`);
    rows.push(`Total Capital USD,${analysis.totals.totalCapitalUSD.toFixed(2)}`);
    rows.push(`Net Exposure USD,${analysis.totals.netExposureUSD.toFixed(2)}`);
    rows.push(`Overall Hedge Ratio %,${analysis.totals.overallHedgeRatio.toFixed(2)}`);

    rows.push('');
    rows.push('APY BREAKDOWN');
    rows.push('Metric,Value %');
    rows.push(`Aave Net APY,${analysis.aaveNetAPY.toFixed(2)}`);
    rows.push(`Hyperliquid Funding APY,${analysis.hyperliquidFundingAPY.toFixed(2)}`);
    rows.push(`Combined Net APY,${analysis.combinedNetAPY.toFixed(2)}`);

    rows.push('');
    rows.push('HEDGE EFFECTIVENESS');
    rows.push('Category,Assets');
    if (analysis.effectiveness.perfectlyHedged.length > 0) {
      rows.push(`Perfectly Hedged (95-105%),${analysis.effectiveness.perfectlyHedged.join('; ')}`);
    }
    if (analysis.effectiveness.partiallyHedged.length > 0) {
      rows.push(`Partially Hedged (20-95%),${analysis.effectiveness.partiallyHedged.join('; ')}`);
    }
    if (analysis.effectiveness.unhedged.length > 0) {
      rows.push(`Unhedged (<20%),${analysis.effectiveness.unhedged.join('; ')}`);
    }
    if (analysis.effectiveness.overHedged.length > 0) {
      rows.push(`Over-Hedged (>105%),${analysis.effectiveness.overHedged.join('; ')}`);
    }

    rows.push('');
    rows.push(`Generated at: ${new Date().toISOString()}`);
    rows.push(`Address: ${address}`);

    const csvContent = rows.join('\n');
    writeFileSync(filename, csvContent, 'utf-8');

    return filename;
  }
}

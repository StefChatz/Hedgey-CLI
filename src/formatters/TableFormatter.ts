import chalk from 'chalk';
import Table from 'cli-table3';
import type { Analysis } from '../types/position';

export class TableFormatter {
  formatPositionsTable(byAsset: Analysis['byAsset']): string {
    const table = new Table({
      head: [
        chalk.bold('Asset'),
        chalk.bold('Supplied'),
        chalk.bold('Borrowed'),
        chalk.bold('Net Position'),
        chalk.bold('USD Value'),
      ],
      colWidths: [12, 15, 15, 20, 15],
    });

    for (const [asset, data] of Object.entries(byAsset)) {
      const netColor = this.getNetPositionColor(data.net);
      const netSign = data.net > 0 ? '+' : '';

      table.push([
        asset,
        data.supplied.toFixed(4),
        data.borrowed.toFixed(4),
        netColor(`${netSign}${data.net.toFixed(4)} (${data.direction})`),
        this.formatUSD(data.netUSD),
      ]);
    }

    return table.toString();
  }

  formatSummary(analysis: Analysis): string {
    const healthFactorDisplay = this.formatHealthFactor(analysis.healthFactor);
    const netAPYDisplay = this.formatNetAPY(analysis.netAPY);

    return `
${chalk.bold.underline('POSITION SUMMARY')}
${'═'.repeat(70)}

${chalk.bold('Total Supplied:')}     ${chalk.green(this.formatUSD(analysis.totalSuppliedUSD))}
${chalk.bold('Total Borrowed:')}     ${chalk.yellow(this.formatUSD(analysis.totalBorrowedUSD))}
${chalk.bold('Net Value:')}          ${chalk.cyan(this.formatUSD(analysis.netValueUSD))}

${chalk.bold('Health Factor:')}      ${healthFactorDisplay}
${chalk.bold('Leverage:')}           ${analysis.leverage.toFixed(2)}x
${chalk.bold('Utilization:')}        ${analysis.utilizationRate.toFixed(1)}%
${chalk.bold('Net APY:')}            ${netAPYDisplay}
`;
  }

  formatLoops(loops: Analysis['loops']): string {
    if (loops.length === 0) {
      return '';
    }

    let output = `\n${chalk.bold.underline('LOOPED POSITIONS DETECTED')}\n`;
    output += '═'.repeat(70) + '\n\n';

    for (const loop of loops) {
      output += chalk.yellow('⚠️  ') + chalk.bold(loop.asset);
      output += chalk.yellow(' - Recursive Position\n');
      output += `   Supplied: ${loop.supplied.toFixed(4)} ${loop.asset}\n`;
      output += `   Borrowed: ${loop.borrowed.toFixed(4)} ${loop.asset}\n`;
      output += `   Effective Leverage: ${chalk.bold(loop.effectiveLeverage.toFixed(2) + 'x')}\n\n`;
    }

    return output;
  }

  private formatHealthFactor(healthFactor: number): string {
    const color = this.getHealthFactorColor(healthFactor);
    const emoji = this.getHealthFactorEmoji(healthFactor);
    const display = healthFactor === Infinity ? '∞' : healthFactor.toFixed(2);
    return color(`${display} ${emoji}`);
  }

  private getHealthFactorColor(healthFactor: number) {
    if (healthFactor === Infinity) return chalk.green;
    if (healthFactor > 2) return chalk.green;
    if (healthFactor > 1.5) return chalk.yellow;
    if (healthFactor > 1.2) return chalk.red;
    return chalk.red.bold;
  }

  private getHealthFactorEmoji(healthFactor: number): string {
    if (healthFactor === Infinity) return '🟢';
    if (healthFactor > 2) return '🟢';
    if (healthFactor > 1.5) return '🟡';
    if (healthFactor > 1.2) return '🟠';
    return '🔴';
  }

  private getNetPositionColor(net: number) {
    if (net > 0) return chalk.green;
    if (net < 0) return chalk.red;
    return chalk.gray;
  }

  private formatUSD(amount: number): string {
    return (
      '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }

  private formatNetAPY(apy: number): string {
    const sign = apy >= 0 ? '+' : '';
    const color = apy >= 0 ? chalk.green : chalk.red;
    return color(`${sign}${apy.toFixed(2)}%`);
  }
}

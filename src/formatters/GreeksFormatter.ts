import chalk from 'chalk';
import type { Greeks } from '../analyzers/GreeksCalculator';

export class GreeksFormatter {
  format(greeks: Greeks): string {
    let output = `\n${chalk.bold.underline('POSITION GREEKS')}\n`;
    output += '═'.repeat(70) + '\n\n';

    output += this.formatDelta(greeks.delta);
    output += this.formatGamma(greeks.gamma);
    output += this.formatVega(greeks.vega);
    output += this.formatTheta(greeks.theta);

    return output;
  }

  private formatDelta(delta: Greeks['delta']): string {
    let output = chalk.bold('DELTA (Directional Exposure)\n');
    output += `Total USD Delta: ${chalk.cyan(this.formatUSD(delta.totalDeltaUSD))}\n\n`;
    output += 'By Asset:\n';

    for (const [asset, data] of Object.entries(delta.byAsset)) {
      const color = data.net > 0 ? chalk.green : chalk.red;
      const sign = data.net > 0 ? '+' : '';
      output += `  ${asset}: ${color(sign)}${color(data.net.toFixed(4))}`;
      output += ` (${color(this.formatUSD(data.deltaUSD))})\n`;
    }

    return output + '\n';
  }

  private formatGamma(gamma: Greeks['gamma']): string {
    let output = chalk.bold('GAMMA (Leverage Exposure)\n');
    output += `Overall Leverage: ${chalk.cyan(gamma.leverage.toFixed(2) + 'x')}\n\n`;
    return output;
  }

  private formatVega(vega: Greeks['vega']): string {
    let output = chalk.bold('VEGA (Interest Rate Sensitivity)\n');
    output += 'If rates increase by 1%:\n';
    output += `  Monthly impact: ${chalk.yellow('+' + this.formatUSD(vega.rateImpactMonthly))}\n`;
    output += `  Yearly impact:  ${chalk.yellow('+' + this.formatUSD(vega.rateImpactYearly))}\n\n`;
    return output;
  }

  private formatTheta(theta: Greeks['theta']): string {
    let output = chalk.bold('THETA (Time Decay / Net Yield)\n');
    output += `  Daily:   ${this.colorizeAmount(theta.dailyNet)}\n`;
    output += `  Monthly: ${this.colorizeAmount(theta.monthlyNet)}\n`;
    output += `  Yearly:  ${this.colorizeAmount(theta.yearlyNet)}\n`;
    return output;
  }

  private colorizeAmount(amount: number): string {
    const color = amount > 0 ? chalk.green : chalk.red;
    const sign = amount > 0 ? '+' : '';
    return color(sign + this.formatUSD(Math.abs(amount)));
  }

  private formatUSD(amount: number): string {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
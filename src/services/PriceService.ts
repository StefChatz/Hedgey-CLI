import ky from 'ky';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  wstETH: 'wrapped-steth',
  LINK: 'chainlink',
  AAVE: 'aave',
  MATIC: 'matic-network',
};

interface CachedPrice {
  price: number;
  timestamp: number;
}

export class PriceService {
  private cache = new Map<string, CachedPrice>();
  private readonly CACHE_EXPIRY = 60000;

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    const uniqueSymbols = [...new Set(symbols)];
    const prices: Record<string, number> = {};
    const toFetch: string[] = [];

    for (const symbol of uniqueSymbols) {
      const cached = this.getCachedPrice(symbol);
      if (cached !== null) {
        prices[symbol] = cached;
      } else {
        toFetch.push(symbol);
      }
    }

    if (toFetch.length === 0) {
      return prices;
    }

    const ids = toFetch.map(s => SYMBOL_TO_COINGECKO_ID[s]).filter(Boolean);

    if (ids.length === 0) {
      return prices;
    }

    try {
      const response = await ky
        .get(`${COINGECKO_API}/simple/price`, {
          searchParams: {
            ids: ids.join(','),
            vs_currencies: 'usd',
          },
          timeout: 10000,
        })
        .json<Record<string, { usd: number }>>();

      for (const symbol of toFetch) {
        const id = SYMBOL_TO_COINGECKO_ID[symbol];
        if (id && response[id]) {
          const price = response[id].usd;
          prices[symbol] = price;
          this.setCachedPrice(symbol, price);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch prices from CoinGecko');
    }

    return prices;
  }

  private getCachedPrice(symbol: string): number | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
      return cached.price;
    }
    return null;
  }

  private setCachedPrice(symbol: string, price: number): void {
    this.cache.set(symbol, {
      price,
      timestamp: Date.now(),
    });
  }
}

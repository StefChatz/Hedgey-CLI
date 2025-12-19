# 🦔 Hedgey

Your DeFi hedging companion - Analyze Aave positions with clarity and confidence

## Setup

### 1. Get Free Alchemy API Keys

1. Sign up at https://alchemy.com
2. Create apps for each chain (Ethereum, Polygon, Arbitrum, Optimism)
3. Copy API keys

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Alchemy keys
nano .env
```

### 3. Install & Run

```bash
# Install dependencies
bun install

# Test it works
bun dev check 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Build for production
bun run build
```

## Usage

```bash
# Check positions
hedgey check 0xYourAddress

# View Greeks
hedgey greeks 0xYourAddress

# Analyze hedge effectiveness (Aave + Hyperliquid)
hedgey hedge 0xYourAddress

# Specify chain
hedgey check 0xYourAddress --chain polygon

# Analyze hedge effectiveness (Aave + Hyperliquid)
hedgey hedge 0xYourAddress --chain polygon
```

## Features

- ✅ Health factor monitoring
- ✅ Position exposure analysis
- ✅ DeFi Greeks (delta, gamma, vega, theta)
- ✅ Loop detection (recursive borrowing)
- ✅ Multi-chain support (Ethereum, Polygon, Arbitrum, Optimism)
- ✅ Powered by Alchemy (fast, reliable, FREE)

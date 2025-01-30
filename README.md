# ETH.PUMP: Fair Launch AMM Platform

eth.pump is an EVM-compatible fair launch platform inspired by pump.fun, designed to provide a more equitable token launch mechanism for L2 chains. Unlike traditional ICOs where early investors often get preferential treatment, eth.pump ensures a truly fair distribution through its innovative AMM-based launch mechanism.

## Key Features

- **Zero-Price Initial Launch**: Tokens start with zero price, allowing early participants to establish the market price organically
- **Automatic Market Making**: Custom AMM implementation with x*y=k formula for efficient price discovery
- **Bonding Curve Migration**: Automatic migration to Uniswap V3 once market cap threshold is reached
- **Early Buyer Rewards**: Fee distribution system that rewards early participants
- **Fair Distribution**: No pre-mines, no pre-sales, just fair market-driven price discovery

## How It Works

### 1. Token Creation & Initial Pool
- Creator deploys a new token through `TokenManager`
- Initial liquidity is added to `MultiAMM` with zero WETH (zero price state)
- Early buyers can purchase tokens at a fixed initial rate

### 2. Price Discovery Phase
- Users can buy tokens through the AMM, gradually establishing price
- Zero price state continues until minimum ETH liquidity threshold is met
- Automatic transition to normal x*y=k pricing once threshold is reached

### 3. Uniswap V3 Migration
- When market cap reaches threshold (85,000 USD), liquidity automatically migrates
- `LiquidityManager` creates Uniswap V3 pool and positions
- Trading continues on Uniswap V3 with concentrated liquidity

## Smart Contract Architecture

### Core Contracts

1. **MultiAMM.sol**
   - Custom AMM implementation
   - Handles zero-price state and normal trading
   - Manages liquidity pools and shares

2. **TokenManager.sol**
   - Token creation and deployment
   - Pool initialization
   - Token ownership tracking

3. **LiquidityManager.sol**
   - Uniswap V3 pool creation
   - Position management
   - Migration logic

4. **CollectFeesManager.sol**
   - Fee collection and distribution
   - Early buyer tracking
   - Reward calculations

### Testing

The project includes comprehensive tests in the `test` directory:

### Install dependencies
```
yarn install
```

### Environment Setup

```
cp .env.example .env
```

### Run MultiAMM tests
```
yarn test:amm
```

### Run MockPriceFeed tests
```
yarn test:mock
```

### Run ICO tests
```
yarn test:ico
```

## Technical Details

### Zero Price Launch
The initial launch phase uses a fixed price ratio:
- 1 token (1e18 wei) = 1e11 wei ETH (0.00000000001 ETH)
- Minimum ETH liquidity threshold: 5 ETH

### Migration Threshold
- Market cap threshold: 85,000 USD
- Calculated using Chainlink price feeds
- Automatic migration triggers when threshold is reached

### Fee Distribution
- 30% of fees distributed to early buyers
- Proportional distribution based on initial purchase amounts
- Automatic collection and distribution through CollectFeesManager

## Security Considerations

- All contracts use SafeMath for arithmetic operations
- Comprehensive access controls and ownership checks
- Price manipulation resistance through minimum liquidity requirements
- Automated testing suite with extensive coverage

## License

MIT License

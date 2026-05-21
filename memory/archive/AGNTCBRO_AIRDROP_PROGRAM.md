# $AGNTCBRO Airdrop Program Design

**Created:** April 5, 2026
**Purpose:** Complete bonding curve, incentivize holding, increase long-term holders

---

## 🎯 Objectives

1. **Complete Pump.fun Bonding Curve** - Reach 100% to migrate to Raydium
2. **Incentivize Long-Term Holding** - Reward holders who stake, not sellers
3. **Increase Token Holders** - Attract new holders through airdrop
4. **Reduce Immediate Sell-Off** - Vesting and staking requirements
5. **Build Community Loyalty** - Reward genuine supporters

---

## 📊 Bonding Curve Status

### Pump.fun Mechanism
- Bonding curve starts at 0% and increases as people buy
- When curve reaches ~$69K market cap (100%), token migrates to Raydium DEX
- Current status: Need to check DexScreener for progress

### Strategy to Complete Curve
1. **Buy pressure from airdrop anticipation**
2. **Holders stake tokens (reducing sell supply)**
3. **Marketing push during airdrop campaign**
4. **Community incentives to promote**

---

## 🏗️ Airdrop Program Structure

### Phase 1: Announcement & Staking Launch (Week 1-2)

**Goal:** Build anticipation, launch staking contract

**Actions:**
1. Announce airdrop program on X, Telegram, Discord
2. Launch staking smart contract on agenticbro.app
3. Set snapshot date for eligibility
4. Create airdrop claim page

**Staking Contract Features:**
- Stake $AGNTCBRO for minimum 30 days
- Minimum stake: **1,000,000 tokens** (~$3.15 USD at current market cap)
- Multipliers based on staking duration:
  - 30 days: 1x multiplier
  - 60 days: 1.5x multiplier
  - 90 days: 2x multiplier
  - 180 days: 3x multiplier

### Phase 2: Accumulation Period (Week 2-4)

**Goal:** Increase holders, build staking pool

**Actions:**
1. Daily snapshots of holder wallets
2. Leaderboard of top stakers
3. Community challenges for bonus multipliers
4. Twitter/X campaign: "Stake to Earn Airdrop"

**Eligibility Requirements:**
- Hold minimum **1,000,000 $AGNTCBRO** (~$3.15 USD)
- Stake for minimum 30 days
- Complete 3 social tasks:
  - Follow @AgenticBro on X
  - Join Telegram group
  - Share airdrop announcement

**Why 1M tokens?**
- Current market cap makes 1M tokens ≈ $3.15 USD
- Ensures genuine supporters, not just airdrop farmers
- Builds committed holder base

### Phase 3: Distribution (Week 4-6)

**Goal:** Complete bonding curve, distribute rewards

### Airdrop Pool:** 3% of total supply (30,000,000 tokens)
**Total Supply:** 1,000,000,000 $AGNTCBRO

**Distribution Model:**
| Tier | Stake Amount | Staking Duration | Airdrop Multiplier | Base Airdrop |
|------|--------------|------------------|-------------------|-------------|
| Bronze | 1M-5M | 30 days | 1x | 15,000 tokens |
| Silver | 5M-10M | 60 days | 1.5x | 22,500 tokens |
| Gold | 10M-50M | 90 days | 2x | 30,000 tokens |
| Diamond | 50M+ | 180 days | 3x | 45,000 tokens |

**Note:** At current market cap, 1M tokens ≈ $3.15 USD

**How Multipliers Work:**
- Base airdrop is determined by your tier
- Multiplier increases with staking duration
- Example: Bronze tier (1M tokens staked) = 10,000 base airdrop
- Example: Silver tier (5M tokens staked for 60 days) = 15,000 tokens airdrop
- Example: Gold tier (10M tokens staked for 90 days) = 20,000 tokens airdrop
- Example: Diamond tier (50M tokens staked for 180 days) = 30,000 tokens airdrop

**Pro-Rata Bonus:**
- If total eligible stakers < 30M tokens, individual airdrops increase proportionally
- If total eligible stakers > 30M tokens, individual airdrops decrease proportionally
- Formula: Your Airdrop = (Your Tier Base × Multiplier) × (30M / Total Staked Pool)

**Example Scenarios:**

| Stakers | Total Staked | Your Stake | Your Tier | Your Airdrop |
|---------|--------------|------------|-----------|-------------|
| 100 | 5M avg | 1M | Bronze (1x) | 10,000 tokens |
| 100 | 10M avg | 5M | Silver (1.5x) | 15,000 tokens |
| 50 | 25M avg | 10M | Gold (2x) | 20,000 tokens |
| 20 | 50M avg | 50M | Diamond (3x) | 30,000 tokens |

**If Oversubscribed (Example):**
- Total staked: 100M tokens
- Pool: 30M tokens
- Ratio: 30M / 100M = 0.3
- Bronze tier: 15,000 × 0.3 = 4,500 tokens
- Diamond tier: 45,000 × 0.3 = 13,500 tokens

**If Undersubscribed (Example):**
- Total staked: 10M tokens
- Pool: 30M tokens
- Ratio: 30M / 10M = 3x bonus
- Bronze tier: 15,000 × 3 = 45,000 tokens
- Diamond tier: 45,000 × 3 = 135,000 tokens

**Vesting Schedule:**
- 25% immediate unlock
- 25% after 30 days
- 25% after 60 days
- 25% after 90 days

---

## 💰 Tokenomics

### Airdrop Allocation
- **Total Airdrop Pool:** 30,000,000 $AGNTCBRO (3% of 1B total supply)
- **Staking Rewards:** Additional 5,000,000 tokens for staking APY (0.5% of supply)
- **Marketing Reserve:** 5,000,000 tokens for influencers/promotions (0.5% of supply)

### Anti-Dump Mechanisms

1. **Staking Requirement**
   - Must stake to receive airdrop
   - Unstaking before period = forfeit airdrop
   - Emergency unstaking = 50% penalty

2. **Vesting Schedule**
   - Airdropped tokens vested over 90 days
   - Early claim = burn 25% of unvested tokens

3. **Sell Tax Dynamic**
   - Normal: 5% buy/sell tax
   - Within 24h of unstaking: 15% sell tax
   - Within 7 days: 10% sell tax
   - After 30 days: 5% sell tax (normal)

4. **Holding Bonus**
   - Hold for 6 months after airdrop
   - Receive additional 20% bonus tokens
   - Must maintain minimum balance

---

## 🔧 Technical Implementation

### Smart Contract Architecture

```
AirdropContract {
  // Staking
  function stake(uint256 amount, uint256 duration)
  function unstake()
  function emergencyUnstake() // 50% penalty
  
  // Airdrop
  function claimAirdrop()
  function getVestedAmount(address user)
  
  // Multipliers
  function calculateMultiplier(address user)
  function getTier(address user)
  
  // Anti-Dump
  function calculateSellTax(address user)
  function isEligible(address user)
  
  // Admin
  function setAirdropAmount(uint256 amount)
  function setVestingSchedule()
}
```

### Website Integration (agenticbro.app)

**New Pages:**
1. `/stake` - Stake $AGNTCBRO
2. `/airdrop` - Airdrop eligibility & claim
3. `/rewards` - Staking rewards dashboard
4. `/leaderboard` - Top stakers

**Features:**
- Connect Phantom wallet
- View staking balance
- See multiplier progress
- Track vesting schedule
- Claim airdrop

---

## 📅 Timeline

| Week | Phase | Actions |
|------|-------|---------|
| 1 | Announcement | Announce program, build hype |
| 2 | Staking Launch | Deploy contract, start staking |
| 3 | Accumulation | Daily snapshots, marketing push |
| 4 | Snapshot | Final eligibility snapshot |
| 5 | Distribution | Airdrop claims open |
| 6 | Vesting Start | Vesting schedule begins |
| 8 | Bonding Curve | Target completion |
| 12 | Full Unlock | All airdrops fully vested |

---

## 📣 Marketing Strategy

### Pre-Launch (Week 1)

**X/Twitter Campaign:**
```
🚨 $AGNTCBRO AIRDROP ANNOUNCEMENT 🚨

2% of total supply (20M tokens) allocated for airdrop!

How to qualify:
✅ Stake $AGNTCBRO (min 100K)
✅ Hold for 30-180 days
✅ Complete social tasks

Multipliers up to 3x for long-term holders!

Details: agenticbro.app/airdrop

#Solana #Airdrop #DeFi
```

**Telegram Campaign:**
- Daily updates on staking progress
- Leaderboard announcements
- Community challenges

### Launch (Week 2-4)

**Influencer Outreach:**
- Partner with Solana influencers
- Revenue share for promotions
- Exclusive early access for top holders

**Community Challenges:**
- Most referrals bonus: 2x multiplier
- Meme contest: 1.5x multiplier
- Community helper: 1.25x multiplier

### Distribution (Week 4-6)

**Claim Campaign:**
- "Claim your airdrop NOW"
- Countdown timers
- FOMO marketing

---

## 📊 Success Metrics

### KPIs to Track

| Metric | Target | Method |
|--------|--------|--------|
| Total Stakers | 1,000+ | Contract data |
| Tokens Staked | 100M+ (10% of supply) | Contract data |
| Bonding Curve Progress | 100% | Pump.fun/DexScreener |
| New Holders | 500+ | Solscan |
| Holder Retention (30d) | 70%+ | Wallet tracking |
| Holder Retention (90d) | 50%+ | Wallet tracking |

### Monitoring Tools
- DexScreener API for bonding curve
- Solscan for holder count
- Contract events for staking data
- Custom dashboard for metrics

---

## 🛡️ Security Considerations

### Smart Contract Audits
- [ ] Internal security review
- [ ] External audit (recommended: OtterSec)
- [ ] Bug bounty program

### Anti-Gaming Measures
1. **Sybil Resistance**
   - Minimum 1M tokens to stake (~$3.15 USD)
   - Wallet age requirement (7+ days)
   - No exchange wallets
   
2. **Whale Protection**
   - Maximum stake per wallet: 10M tokens (1% of supply)
   - Anti-monopoly mechanisms
   
3. **Flash Loan Protection**
   - Must hold tokens for 24h before staking
   - No same-day stake/unstake

---

## 💡 Alternative: Hold-to-Earn Model

### Simpler Approach (No Staking Contract)

**Mechanism:**
1. Take snapshot of all holders
2. Calculate holding duration for each wallet
3. Airdrop based on holding time:
   - 0-7 days: 0.5x
   - 7-30 days: 1x
   - 30-90 days: 1.5x
   - 90+ days: 2x

**Pros:**
- No smart contract needed
- Immediate implementation
- Simpler for users

**Cons:**
- Less control over sell-offs
- No staking APY
- Harder to prevent gaming

---

## 🚀 Quick Start Implementation

### Minimum Viable Program (Week 1)

**Step 1: Announce Airdrop**
```
🪂 $AGNTCBRO AIRDROP PROGRAM

We're allocating 20M tokens (2% supply) for our community!

Eligibility:
• Hold 1M+ $AGNTCBRO (~$3.15 USD)
• Stake for 30+ days
• Follow + Retweet

Stake to earn multipliers up to 3x!

agenticbro.app/stake

$AGNTCBRO #Solana
```

**Step 2: Launch Simple Staking**
- Use existing Solana staking tools (Marinade, Jito)
- Or deploy simple staking contract

**Step 3: Track Holders**
- Use Smithii snapshot tool
- Export holder list weekly
- Calculate multipliers

**Step 4: Distribute**
- Use Smithii Multisender (cost: ~3 SOL for 1000 wallets)
- Or use Streamflow for vesting

---

## 📋 Recommendations

### Immediate Actions

1. **Check Bonding Curve Status**
   - Query DexScreener API
   - Determine % completion
   - Calculate needed buy pressure

2. **Decide on Approach**
   - Full staking contract (2-4 weeks)
   - Hold-to-earn snapshot (1 week)

3. **Allocate Tokens**
   - Reserve 20M tokens for airdrop (2%)
   - Reserve 5M tokens for staking APY (0.5%)
   - Ensure not already in circulation

4. **Set Timeline**
   - Announcement: Immediate
   - Staking launch: Week 2
   - Distribution: Week 5

### Cost Estimates

| Item | Cost | Notes |
|------|------|-------|
| Smart Contract Deploy | 5-10 SOL | One-time |
| Airdrop Distribution | 3 SOL per 1000 wallets | Using Smithii |
| Staking APY Pool | 10M tokens | From reserve |
| Marketing | Variable | Influencers, etc. |

---

## 🎯 Expected Outcomes

### After Phase 1 (Announcement)
- 20-30% price increase (hype)
- 200+ new holders
- 50+ stakers

### After Phase 2 (Staking Launch)
- 40-50% price increase
- 500+ new holders
- 200+ stakers
- Bonding curve: 60-70%

### After Phase 3 (Distribution)
- Bonding curve: 100% ✅
- 1000+ holders
- 500+ long-term stakers
- Successful Raydium migration

---

### How Airdrop Tiers Work

**Base Airdrop by Tier:**
| Tier | Min Stake | Base Airdrop | Max Airdrop (with multiplier) |
|------|-----------|--------------|------------------------------|
| Bronze | 1M tokens | 15,000 tokens | 15,000 tokens (1x) |
| Silver | 5M tokens | 22,500 tokens | 33,750 tokens (1.5x) |
| Gold | 10M tokens | 30,000 tokens | 60,000 tokens (2x) |
| Diamond | 50M tokens | 45,000 tokens | 135,000 tokens (3x) |

**Pro-Rata Distribution:**
- If pool is undersubscribed: Your airdrop increases proportionally
- If pool is oversubscribed: Your airdrop decreases proportionally
- Formula: Your Airdrop = (Tier Base × Multiplier) × (30M Pool / Total Staked)

**USD Value at Current Market Cap:**
- Bronze (15K tokens): ~$0.05 USD
- Silver (22.5K-33.8K tokens): ~$0.07-$0.11 USD
- Gold (30K-60K tokens): ~$0.09-$0.19 USD
- Diamond (45K-135K tokens): ~$0.14-$0.42 USD

**Why Low USD Values?**
- Current market cap is very low
- As bonding curve completes and price increases, airdrop value increases
- Early holders benefit most from price appreciation
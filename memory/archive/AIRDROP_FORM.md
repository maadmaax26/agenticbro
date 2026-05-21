# $AGNTCBRO Airdrop Eligibility Form

**Created:** April 5, 2026
**Purpose:** Capture and verify participant eligibility for airdrop

---

## 📋 Options for Social Verification

### Option 1: SweepWidget (RECOMMENDED)
**Cost:** $29/month (or free tier with limits)
**Features:**
- ✅ Auto-verify X follows
- ✅ Auto-verify X likes/retweets
- ✅ Auto-verify Telegram joins
- ✅ Custom form fields for wallet address
- ✅ Built for airdrops/giveaways
- ✅ 30+ social platforms

**How it works:**
1. Create SweepWidget campaign
2. Add entry methods:
   - Follow @AgenticBro on X
   - Join t.me/AgenticBro
   - Like & RT airdrop post
3. Add custom field for wallet address
4. Users connect social accounts to verify
5. Export verified list after snapshot

**Link:** https://sweepwidget.com

---

### Option 2: Gleam.io
**Cost:** $49/month (no free tier for crypto)
**Features:**
- ✅ Auto-verify X follows
- ✅ Auto-verify X retweets
- ❌ No Telegram verification (manual only)
- ✅ Built-in fraud detection

**Pros:**
- Trusted platform
- Good fraud prevention

**Cons:**
- No native Telegram verification
- Higher cost

---

### Option 3: Google Form + Manual Verification (FREE)
**Cost:** $0
**Features:**
- ❌ No auto-verification
- ✅ Custom fields for all info
- ✅ Export to CSV

**How it works:**
1. Create Google Form with fields:
   - X username
   - Telegram username
   - Wallet address
   - Holdings amount
   - Screenshot upload
2. Manually verify each submission:
   - Check if following @AgenticBro
   - Check if in Telegram group
   - Check if liked/RT'd post
3. Mark as verified in spreadsheet

**Verification Methods:**
- X API to check follow status
- Telegram bot to check group membership
- Manual review of screenshots

---

### Option 4: Custom Telegram Bot (FREE-$50)
**Cost:** $0-50 (development/hosting)
**Features:**
- ✅ Auto-verify Telegram join
- ❌ Manual X verification
- ✅ Store data in database

**How it works:**
1. Create Telegram bot
2. Bot asks for:
   - X username
   - Wallet address
3. Bot checks if user is in group
4. User submits X screenshot manually
5. Admin verifies X tasks

---

## 🎯 Recommended Solution

### Best: SweepWidget ($29/month)

**Why:**
- All-in-one verification
- Built for airdrops
- Auto-verifies ALL tasks
- Easy export to CSV
- Fraud detection included

### Backup: Google Form (FREE)

**Why:**
- Zero cost
- Easy to set up
- Manual verification is time-consuming but works

---

## 📝 Google Form Fields (Backup Option)

### Form Title
$AGNTCBRO Airdrop Eligibility Registration

### Section 1: Wallet Information
1. **Solana Wallet Address** (required)
   - Format: Must start with a valid Solana address
   - Validation: Regex for Solana addresses

2. **Holdings Amount** (required)
   - Number field
   - Must be ≥ 4,000,000

### Section 2: Social Verification

3. **X (Twitter) Username** (required)
   - Format: @username or username
   - Used to verify follow

4. **Telegram Username** (required)
   - Format: @username or username
   - Used to verify group membership

5. **Link to Your Like/RT** (required)
   - URL field
   - Link to your like or retweet of airdrop post

### Section 3: Confirmation

6. **I confirm my wallet is 7+ days old** (checkbox, required)

7. **I confirm this is my personal wallet (not exchange)** (checkbox, required)

8. **Screenshot of Holdings** (file upload, optional)
   - PNG/JPG only
   - Max 5MB

---

## 🔍 Manual Verification Process

### Step 1: Export Form Responses
- Download CSV from Google Forms
- Filter by holdings ≥ 4M

### Step 2: Verify X Follow
```python
import requests

def check_x_follow(username):
    """Check if user follows @AgenticBro"""
    # Use X API v2 (requires API key)
    # GET /2/users/by/username/{username}/following
    # Check if AgenticBro ID is in following list
    pass
```

### Step 3: Verify Telegram Membership
```python
# Use Telegram Bot API
bot_token = "***REMOVED***"

def check_telegram_membership(username):
    """Check if user is in AgenticBro group"""
    # GET /getChatMember?chat_id=-1003751594817&user_id={user_id}
    # Requires user_id, not username
    pass
```

### Step 4: Verify Like/RT
- Manual check via X
- Or use X API to check retweet status

### Step 5: Mark as Verified
- Update spreadsheet with verification status
- Add "Verified" column
- Filter verified users for distribution

---

## 📊 Verification Status Tracking

| Field | Verification Method | Status |
|-------|---------------------|--------|
| Holdings ≥ 4M | On-chain snapshot | ✅ Automatic |
| Wallet age 7+ days | On-chain check | ✅ Automatic |
| X follow | X API or manual | ⚠️ Semi-auto |
| Telegram join | Bot API | ✅ Automatic |
| Like/RT | X API or manual | ⚠️ Semi-auto |

---

## 🚀 Implementation Timeline

| Date | Action |
|------|--------|
| April 5 | Set up SweepWidget or Google Form |
| April 19 | Open registration form |
| April 20 | Take snapshot |
| April 21-26 | Verify all submissions |
| April 27 | First distribution (25%) |

---

## 📝 Decision Required

**Choose one:**
1. **SweepWidget ($29/mo)** - Full auto-verification
2. **Google Form (FREE)** - Manual verification

**Recommendation:** Use SweepWidget for professionalism and fraud prevention, or Google Form for zero cost with manual work.

---

**Files:**
- Form fields: This document
- X Post: `/x-posts/airdrop-announcement-post.md`
- Implementation: `/memory/AIRDROP_IMPLEMENTATION.md`
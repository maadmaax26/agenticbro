# Agentic Bro Agent Split Architecture

**Created:** March 29, 2026
**Purpose:** Split Agentic Bro into two specialized agents for optimal performance and cost efficiency

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Agentic Bro Group (-1003751594817)                  │
│                         Telegram Group Interface                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
        ┌───────────▼───────────┐       ┌──────────▼──────────┐
        │   CONVERSATIONALIST   │       │      ANALYST       │
        │     (Local Model)     │       │   (Cloud Model)    │
        │                       │       │                     │
        │   ollama/qwen3.5:9b   │       │  ollama/glm-5:cloud │
        │                       │       │                     │
        │  • Fast responses     │       │  • Deep analysis     │
        │  • Multi-language     │       │  • Web searches      │
        │  • Community chat     │       │  • Scam detection    │
        │  • Quick reactions    │       │  • Priority scans    │
        │  • Low latency        │       │  • Browser tabs      │
        │  • Zero API cost      │       │  • Complex reasoning │
        └───────────────────────┘       └─────────────────────┘
```

---

## Agent Roles

### 1. Conversationalist Agent

**Model:** `ollama/qwen3.5:9b` (local)
**Purpose:** Fast, responsive community engagement

**Responsibilities:**
- Welcome new members
- Answer general questions about Agentic Bro
- Respond to casual conversation
- Provide quick scam tips and educational content
- Detect when tasks need Analyst handoff
- Keep group active and engaged
- Multi-language support (201 languages)

**Capabilities:**
- ✅ Fast inference (~2-5 seconds response)
- ✅ Zero API cost (local model)
- ✅ 201 languages supported
- ✅ Vision capability (if needed)
- ✅ Tool calling (for handoff detection)

**Tasks (handled locally):**
- Daily greetings and check-ins
- Educational content posting
- General crypto safety advice
- FAQ responses
- Community moderation alerts
- Simple engagement questions

**Handoff Triggers:**
When user requests:
- Scam detection scans
- Priority scans
- Profile investigations
- Web searches
- Browser automation
- Complex analysis

---

### 2. Analyst Agent

**Model:** `ollama/glm-5:cloud` (remote)
**Purpose:** Deep analysis and real-time data access

**Responsibilities:**
- Scam detection scans (X profiles, Telegram channels)
- Priority scans with web fetch
- Browser automation (Chrome CDP)
- Risk scoring and analysis
- Investigation reports
- Token verification (DexScreener/Solscan)
- Complex multi-step reasoning

**Capabilities:**
- ✅ 744B total parameters (40B active)
- ✅ Strong reasoning and agentic capabilities
- ✅ Complex systems engineering
- ✅ Long-horizon tasks
- ✅ Web tool access
- ✅ Browser automation

**Tasks (requires cloud):**
- X profile scanning
- Telegram channel analysis
- Token impersonation detection
- Scammer database updates
- Risk score calculations
- Investigation reports
- Multi-source verification

---

## Model Specifications

### Conversationalist: qwen3.5:9b

| Spec | Value |
|------|-------|
| Parameters | 9B |
| Size | 6.6 GB |
| Languages | 201 |
| Context | 128K tokens |
| License | Apache 2.0 |
| Tools | ✅ Yes |
| Vision | ✅ Yes |
| Thinking | ✅ Yes |
| Inference Speed | ~2-5 sec |

**Key Strengths:**
- Global linguistic coverage (201 languages)
- Fast inference for real-time chat
- Strong instruction following
- Tool calling for handoffs
- Multimodal capabilities

**Why qwen3.5:9b over alternatives:**
- Already installed and ready
- Larger language support than qwen2.5 (201 vs 29)
- Smaller footprint than glm-4.7-flash (6.6GB vs 19GB)
- More capable than ministral-3 for conversation
- Apache 2.0 license (commercial-friendly)

---

### Analyst: glm-5:cloud

| Spec | Value |
|------|-------|
| Parameters | 744B total, 40B active |
| Architecture | MoE (Mixture of Experts) |
| Strength | Complex reasoning, agentic tasks |
| Cloud | Yes (ollama/glm-5:cloud) |
| Tools | ✅ Yes |
| Web Access | ✅ Yes |

**Key Strengths:**
- Strongest model in 40B active parameter class
- Built for complex systems engineering
- Long-horizon task completion
- Excellent for multi-step analysis
- Web tool integration

---

## Handoff Protocol

### When Conversationalist Hands Off to Analyst

**Trigger Conditions:**
1. User requests scam scan: "scan @username"
2. User asks for investigation: "investigate this channel"
3. User mentions priority scan: "priority scan @handle"
4. User asks for web search: "search for info on..."
5. User requests verification: "verify this contract"

**Handoff Message Format:**
```
🔍 [Handoff to Analyst]

User: @username
Task: [Specific task description]
Context: [Relevant context from conversation]

Conversationalist signing off. Analyst taking over.
```

**Analyst Response:**
```
✅ Analyst activated

[Completes task]

[Returns result to group]

[Hands back to Conversationalist]
```

---

### When Analyst Hands Back to Conversationalist

**After completing:**
- Scam detection scan
- Investigation report
- Priority scan
- Web fetch task

**Handback Message:**
```
📊 Analysis complete. Results posted above.

Conversationalist resuming for follow-up questions.
```

---

## Implementation Steps

### Step 1: Create Agent Configurations

**Conversationalist Agent Config:**
```json
{
  "name": "agentic-bro-conversationalist",
  "model": "ollama/qwen3.5:9b",
  "runtime": "local",
  "tools": ["sessions_send", "memory_search"],
  "systemPrompt": "You are Agentic Bro's community engagement agent...",
  "handoffTarget": "agentic-bro-analyst"
}
```

**Analyst Agent Config:**
```json
{
  "name": "agentic-bro-analyst",
  "model": "ollama/glm-5:cloud",
  "runtime": "cloud",
  "tools": ["web_fetch", "exec", "read", "write", "sessions_send"],
  "systemPrompt": "You are Agentic Bro's scam detection analyst...",
  "handoffTarget": "agentic-bro-conversationalist"
}
```

### Step 2: Configure Telegram Sessions

Both agents need access to the same group:
- Group ID: `-1003751594817`
- Session type: Shared or coordinated

### Step 3: Implement Handoff Logic

**Conversationalist checks for:**
- Scan requests
- Investigation keywords
- Priority scan triggers
- Web search requests

**Analyst checks for:**
- Task completion
- Ready to hand back

### Step 4: Test Handoff Flow

1. User asks: "Hello, how's everyone?"
   - Conversationalist responds locally

2. User asks: "Scan @suspicious_account"
   - Conversationalist detects handoff trigger
   - Analyst takes over, completes scan
   - Analyst posts results
   - Hands back to Conversationalist

---

## Cost Analysis

### Before Split (Cloud-only)
- All messages: cloud API cost
- Estimated: $50-100/month

### After Split (Hybrid)
- 80% of messages: Local (qwen3.5:9b) = $0
- 20% of messages: Cloud (glm-5:cloud) = $10-20/month
- **Estimated savings: 80-90%**

---

## Performance Metrics

### Conversationalist (qwen3.5:9b)
- Response time: ~2-5 seconds
- Throughput: High (local inference)
- Latency: Minimal (no network)
- Availability: 100% (local)

### Analyst (glm-5:cloud)
- Response time: ~10-30 seconds (complex tasks)
- Throughput: Lower (API rate limits)
- Latency: Network-dependent
- Availability: 99% (cloud)

---

## Monitoring

### Key Metrics to Track
1. **Handoff frequency** - How often Conversationalist → Analyst
2. **Response times** - Both agents
3. **User satisfaction** - Response quality
4. **Cost savings** - API usage reduction
5. **Error rates** - Handoff failures

### Alerts
- Handoff failures
- Analyst timeout
- Conversationalist overload
- Model availability issues

---

## Rollout Plan

### Phase 1: Testing (Week 1)
- Deploy both agents in test mode
- Test handoff scenarios
- Verify response quality
- Monitor performance

### Phase 2: Soft Launch (Week 2)
- Deploy to Agentic Bro group
- Monitor real conversations
- Collect feedback
- Tune handoff triggers

### Phase 3: Full Deployment (Week 3)
- Full production mode
- Cost tracking enabled
- Performance optimization
- Community feedback loop

---

## Risk Mitigation

### Potential Issues
1. **Handoff failures** - Analyst doesn't respond
   - Fallback: Conversationalist posts error message

2. **Slow Analyst responses** - Users waiting
   - Mitigation: Post "Analyzing..." message immediately

3. **Model confusion** - Wrong agent responds
   - Solution: Clear handoff protocol and triggers

4. **API cost spikes** - Unexpected high usage
   - Monitor: Daily cost tracking
   - Limit: Rate limits on Analyst calls

---

## Conclusion

**Recommended Setup:**
- **Conversationalist:** `ollama/qwen3.5:9b` (local, already installed)
- **Analyst:** `ollama/glm-5:cloud` (cloud, already configured)

**Benefits:**
- 80-90% cost reduction (local model for most chats)
- Faster responses for community engagement
- Complex analysis capabilities retained (cloud model)
- 201 languages supported
- Seamless handoff protocol
- Scalable architecture

**Next Steps:**
1. Create agent configurations
2. Implement handoff protocol
3. Test in development environment
4. Deploy to Agentic Bro group
5. Monitor and optimize

---

*Document created: March 29, 2026*
*Last updated: March 29, 2026*
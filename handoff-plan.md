# Handoff Plan: Model Rotation to kimi-k2.6:cloud

## 🔄 Model Change Required

**Current Model:** `ollama/glm-5.1:cloud` (or `ollama/qwen3.5:9b` in this session)
**Target Model:** `ollama/kimi-k2.6:cloud`

## ⚠️ Important Notes

The `ollama/kimi-k2.6:cloud` model is currently listed as a **fallback** in the agent config, not the primary model. This is intentional for handling:
- Model cooldown cascades
- Heavy task offloading
- Emergency failover

## 📋 Action Items

1. **Primary Model Rotation** - Change the main agent model to `ollama/kimi-k2.6:cloud`
   - Requires gateway restart or config patch
   - Consider making it primary for complex analysis tasks
   - Keep `ollama/glm-5.1:cloud` as fallback for simpler tasks

2. **Load Handoff Plan** - Execute after model change:
   - Verify model is loaded and ready
   - Test with a simple query
   - Confirm fallback chain is intact

3. **Cron Job Continuity** - Ensure all cron jobs remain functional:
   - website-deep-scan-processor
   - token-reminder
   - member-welcome
   - nightly-review
   - buy-energy-boost

## 🔄 Fallback Chain

```
Primary: ollama/kimi-k2.6:cloud (new)
  ↓
Fallback: ollama/glm-5.1:cloud
  ↓
Final Fallback: ollama/qwen3.5:9b
```

## ✅ Verification Steps

- [ ] Model loads without error
- [ ] Basic query responds correctly
- [ ] All cron jobs execute successfully
- [ ] No cooldown cascade occurs
- [ ] Webchat session maintains continuity

---

*Handoff initiated: Sun 2026-05-10 00:00 EDT*

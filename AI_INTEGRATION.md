# AI Integration Guide

## Ollama Cloud (Recommended — Free)

### Setup

1. **Check your Ollama Pro status**
   - You should already have Ollama Pro configured
   - Models available: `glm-4.7:cloud`, `qwen3.5:cloud`, `deepseek-v3.2:cloud`

2. **Configure environment**
   ```bash
   # In .env.local
   VITE_AI_PROVIDER=ollama
   VITE_OLLAMA_API_URL=https://api.ollama.com
   VITE_OLLAMA_MODEL=glm-4.7:cloud
   ```

3. **Test the connection**
   ```bash
   # Test API directly
   curl https://api.ollama.com/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "glm-4.7:cloud",
       "messages": [{"role": "user", "content": "Test roast"}],
       "max_tokens": 50
     }'
   ```

### Model Options

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `glm-4.7:cloud` | Fast | Excellent | **Recommended for roasts** |
| `qwen3.5:cloud` | Fast | Very Good | Good alternative |
| `deepseek-v3.2:cloud` | Fast | Good | Good for creative roasts |

### Advantages
- ✅ Free (included in Ollama Pro)
- ✅ No additional API key
- ✅ Data stays on your infrastructure
- ✅ Fast response times
- ✅ Multiple model options

---

## OpenAI (Alternative — Paid)

### Setup

1. **Get API key**
   - Go to [platform.openai.com](https://platform.openai.com)
   - Create API key
   - Add credits to account

2. **Configure environment**
   ```bash
   # In .env.local
   VITE_AI_PROVIDER=openai
   VITE_OPENAI_API_KEY=sk-your-openai-key
   ```

### Model
- Uses `gpt-4o-mini` by default
- Fast, cost-effective ($0.15 per 1M input tokens)

### Advantages
- ✅ Mature ecosystem
- ✅ Excellent quality
- ✅ Reliable

### Disadvantages
- ❌ Costs money
- ❌ Need separate API key
- ❌ Data leaves your infrastructure

---

## Local Ollama (Development Only)

### Setup

1. **Install Ollama**
   ```bash
   brew install ollama
   ```

2. **Pull model**
   ```bash
   ollama pull qwen2.5:7b
   ```

3. **Configure environment**
   ```bash
   # In .env.local
   VITE_AI_PROVIDER=ollama
   VITE_OLLAMA_API_URL=http://localhost:11434
   VITE_OLLAMA_MODEL=qwen2.5:7b
   ```

### Use Case
- Development/testing
- No internet connection needed
- Free

---

## Fallback Mode

If no AI provider is configured, AIBRO will use **mock roasts**:
- Pre-written roast templates
- Condition-based selection (win rate, gas spent, degen score)
- Never repeats (random selection)

---

## Recommendation

**For Production:** Use **Ollama Cloud** (`glm-4.7:cloud`)

Why:
- Already paying for Ollama Pro
- No additional cost
- Excellent roast quality
- Private infrastructure
- Fast response times

---

## Troubleshooting

### Ollama not responding
```bash
# Test connection
curl https://api.ollama.com/v1/models

# Check model list
curl https://api.ollama.com/v1/tags
```

### Roasts not generating
- Check `VITE_AI_PROVIDER` is set correctly
- Check browser console for errors
- Verify API URL is accessible
- Try mock mode first (remove AI provider vars)

### Slow response times
- Try a faster model (`glm-4.7:cloud` is fastest)
- Check network connection
- Consider reducing `max_tokens` in the code

---

Built for degens, by degens. 🤖💸
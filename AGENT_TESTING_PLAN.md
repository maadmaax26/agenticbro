# Agent Testing Plan

## Purpose
Test each of the 7 newly created agents individually to verify they work correctly.

## Agents to Test

### 1. query-router-1
- **Test Query:** "What's the time?"
- **Expected Response:** Current time, < 1 second
- **Agent Should:** Handle simple query locally, no delegation

### 2. query-router-2
- **Test Query:** "Hello!"
- **Expected Response:** Greeting, < 1 second
- **Agent Should:** Handle simple query locally, no delegation

### 3. telegram-manager
- **Test Query:** "Post a message to the Agentic Bro group"
- **Expected Response:** Confirmation of delegation or attempt to post
- **Agent Should:** Recognize Telegram task, handle or delegate appropriately

### 4. web-scraper
- **Test Query:** "Search for 'crypto scam detection'"
- **Expected Response:** Search results, < 2 seconds
- **Agent Should:** Use web_search, handle API-based scraping

### 5. web-scraper (Browser Tab)
- **Test Query:** "Scan X profile @test_account"
- **Expected Response:** Browser navigation attempt, < 3 seconds
- **Agent Should:** Recognize X URL, use browser tab

### 6. file-manager
- **Test Query:** "Read scammer-database.csv"
- **Expected Response:** File contents or summary, < 2 seconds
- **Agent Should:** Use read tool, handle file operations

### 7. complex-op-agent-1
- **Test Query:** "Analyze this scam pattern: VIP tier structure with guaranteed returns"
- **Expected Response:** Analysis with risk assessment, < 10 seconds
- **Agent Should:** Perform complex reasoning, use full tool access

### 8. complex-op-agent-2
- **Test Query:** "Generate Python code for web scraping"
- **Expected Response:** Code snippet, < 15 seconds
- **Agent Should:** Generate code, use full tool access

## Testing Method

For each agent:
1. Spawn a test session using sessions_spawn
2. Send a test query
3. Measure response time
4. Verify response quality
5. Check for delegation behavior
6. Document results

## Success Criteria

- ✅ Agent responds within target time
- ✅ Response is relevant and accurate
- ✅ Delegation works as expected
- ✅ No errors in logs
- ✅ Tools used correctly

## Results Template

```
### [Agent Name]
- **Test Query:** [query]
- **Response Time:** [time]
- **Response:** [summary]
- **Delegation:** [yes/no]
- **Tools Used:** [tools]
- **Status:** ✅ Pass / ❌ Fail
```

---

**Created:** 2026-03-27 21:12 EDT
**Status:** Ready to test
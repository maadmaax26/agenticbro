/**
 * CDP-based AGNTCBRO holder snapshot
 * Uses Chrome DevTools Protocol on port 18801 to fetch holder data
 * from Solscan/SolanaFM (bypasses API rate limits since we use a real browser)
 */

const CDP_PORT = 18801;
const MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump";

async function cdpCall(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 100000);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 30000);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off("message", handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const WebSocket = (await import("ws")).default;
  
  // Get the first page target
  const targetsRes = await fetch(`http://localhost:${CDP_PORT}/json`);
  const targets = await targetsRes.json();
  
  // Find existing page or create new
  let pageTarget = targets.find(t => t.type === "page" && t.url.includes("solscan"));
  let wsUrl;
  
  if (pageTarget) {
    wsUrl = pageTarget.webSocketDebuggerUrl;
  } else {
    // Use the browser WebSocket to create a new target
    const browserWsUrl = targets.find(t => t.type === "page")?.webSocketDebuggerUrl 
      || `ws://localhost:${CDP_PORT}/devtools/browser/`;
    
    // Just use the first available page
    const pageTargets = targets.filter(t => t.type === "page");
    if (pageTargets.length > 0) {
      wsUrl = pageTargets[0].webSocketDebuggerUrl;
    } else {
      console.error("No page targets found");
      process.exit(1);
    }
  }
  
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.once("open", r));
  
  try {
    // Navigate to Solscan token holders page
    console.log("Navigating to Solscan token holders...");
    await cdpCall(ws, "Page.navigate", {
      url: `https://solscan.io/token/${MINT}#holders`
    });
    
    // Wait for page load
    await new Promise(r => setTimeout(r, 8000));
    
    // Try SolanaFM as backup
    console.log("Trying SolanaFM API via browser context...");
    
    // Execute JS in the page to fetch holder data using SolanaFM API
    // The browser context bypasses CORS
    const result = await cdpCall(ws, "Runtime.evaluate", {
      expression: `
        (async () => {
          try {
            // Try SolanaFM holders API
            const resp = await fetch('https://api.solana.fm/v1/tokens/${MINT}/holders?limit=100&page=1');
            const data = await resp.json();
            return JSON.stringify(data);
          } catch(e1) {
            try {
              // Fallback: try Solscan internal API
              const resp2 = await fetch('https://api.solscan.io/v2/token/holders?token=${MINT}&offset=0&size=100');
              const data2 = await resp2.json();
              return JSON.stringify(data2);
            } catch(e2) {
              // Last resort: scrape the page DOM for holder data
              const rows = document.querySelectorAll('table tbody tr, [class*="holder"], [class*="row"]');
              const holders = [];
              rows.forEach(row => {
                const cells = row.querySelectorAll('td, [class*="cell"]');
                if (cells.length >= 2) {
                  holders.push({
                    address: cells[0]?.textContent?.trim(),
                    amount: cells[1]?.textContent?.trim(),
                    pct: cells[2]?.textContent?.trim()
                  });
                }
              });
              return JSON.stringify({source: 'dom', holders, error: e1.message + ' | ' + e2.message});
            }
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    
    console.log("\n=== HOLDER DATA ===");
    const data = JSON.parse(result.result.value || "{}");
    
    if (data.source === "dom" && data.holders?.length > 0) {
      console.log("Source: DOM scrape from Solscan page");
      data.holders.forEach((h, i) => {
        console.log(`${i+1}. ${h.address}  ${h.amount}  ${h.pct}`);
      });
    } else if (data.data || data.result) {
      console.log("Source: API response");
      console.log(JSON.stringify(data, null, 2).slice(0, 10000));
    } else {
      console.log("Raw response:");
      console.log(JSON.stringify(data, null, 2).slice(0, 10000));
    }
    
  } finally {
    ws.close();
  }
}

run().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
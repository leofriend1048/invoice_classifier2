// scripts/autoRetry.ts

/**
 * Auto‐retry for /api/debug-gmail. Parses the “Retry after” UTC timestamp,
 * converts it to local time (Manila), waits until a 5 minute buffer past that moment,
 * then retries automatically.
 * 
 * Run with:
 *   npx tsx ./scripts/autoRetry.ts
 */

(async () => {
  console.log('🎯 Starting auto-retry script for Gmail history ID…');

  async function fetchHistoryId() {
    try {
      const res = await fetch('http://localhost:3000/api/debug-gmail');

      if (res.status === 429) {
        // Rate-limited: parse “Retry after YYYY-MM-DDTHH:MM:SS.sssZ”
        const body = await res.json();
        const msg = body.details?.error?.message || body.error || '';
        const match = msg.match(/Retry after (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/);

        if (!match) {
          console.error('❌ Could not parse Retry-after timestamp from:', msg);
          return;
        }

        const utcString = match[1]; // e.g. "2025-06-04T12:54:13.328Z"
        const retryDateUtc = new Date(utcString);
        const now = new Date();

        // Convert to local (Manila) for logging
        const retryDateLocal = new Date(retryDateUtc.getTime() + 8 * 60 * 60 * 1000);

        console.log(`↻ Rate‐limited until (UTC)  : ${retryDateUtc.toISOString()}`);
        console.log(
          `   That is (Manila local): ${
            retryDateLocal.toISOString().replace('T', ' ').slice(0, 19)
          } (+08:00)`
        );

        // Compute milliseconds until retryDateUtc + 5 minutes (300000 ms) buffer
        const fiveMinutes = 5 * 60 * 1000;
        const waitMs = Math.max(0, retryDateUtc.getTime() - now.getTime() + fiveMinutes);
        console.log(`   Waiting ${(waitMs / 1000).toFixed(1)} seconds (5 min buffer) before retry…`);

        setTimeout(fetchHistoryId, waitMs);
        return;
      }

      if (!res.ok) {
        console.error(`⛔ Unexpected HTTP ${res.status} ${res.statusText}`);
        console.log(await res.text());
        return;
      }

      // 200 OK → success
      const payload = await res.json();
      console.log('✅ Success! History ID =', payload.historyId);
    } catch (err) {
      console.error('⚠️ Network or parsing error:', err);
    }
  }

  // First invocation
  await fetchHistoryId();
})();

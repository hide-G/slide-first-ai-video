import { UrlReachabilityResult } from "../types.js";

/**
 * Extract all URLs from markdown content.
 */
export function extractUrls(markdown: string): string[] {
  const urlPattern = /https?:\/\/[^\s)>\]"'`]+/g;
  const matches = markdown.match(urlPattern);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Check URL reachability via HEAD requests.
 *
 * NOTE: This check requires network access and is marked as integration-only.
 * In CI environments without network access, use the mock version or skip this check.
 */
export async function checkUrlReachability(
  markdown: string,
  fetchFn: (url: string) => Promise<boolean> = defaultFetch,
): Promise<UrlReachabilityResult> {
  const urls = extractUrls(markdown);

  if (urls.length === 0) {
    return { totalUrls: 0, reachableCount: 0, unreachableUrls: [] };
  }

  const unreachableUrls: string[] = [];
  let reachableCount = 0;

  for (const url of urls) {
    const reachable = await fetchFn(url);
    if (reachable) {
      reachableCount++;
    } else {
      unreachableUrls.push(url);
    }
  }

  return {
    totalUrls: urls.length,
    reachableCount,
    unreachableUrls,
  };
}

/**
 * Default fetch function using HEAD requests.
 * Integration-only: requires network access.
 */
async function defaultFetch(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

import { describe, it, expect } from "vitest";
import { checkUrlReachability, extractUrls } from "../checks/url-reachability.js";

describe("extractUrls", () => {
  it("should extract URLs from markdown links", () => {
    const md = `
Check [this docs](https://docs.aws.amazon.com/lambda) and [that page](https://nodejs.org/en/docs).
`;
    const urls = extractUrls(md);
    expect(urls).toContain("https://docs.aws.amazon.com/lambda");
    expect(urls).toContain("https://nodejs.org/en/docs");
  });

  it("should extract bare URLs", () => {
    const md = `Visit https://example.com/path for details.`;
    const urls = extractUrls(md);
    expect(urls).toContain("https://example.com/path");
  });

  it("should deduplicate URLs", () => {
    const md = `
See https://example.com and https://example.com again.
`;
    const urls = extractUrls(md);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://example.com");
  });

  it("should return empty array for no URLs", () => {
    const md = `# Just a title\n\nNo links here.`;
    const urls = extractUrls(md);
    expect(urls).toHaveLength(0);
  });
});

describe("checkUrlReachability", () => {
  it("should identify all URLs as reachable when fetch succeeds", async () => {
    const md = `
Visit https://example.com and https://docs.aws.amazon.com/test
`;
    const mockFetch = async () => true;
    const result = await checkUrlReachability(md, mockFetch);

    expect(result.totalUrls).toBe(2);
    expect(result.reachableCount).toBe(2);
    expect(result.unreachableUrls).toHaveLength(0);
  });

  it("should identify unreachable URLs when fetch fails", async () => {
    const md = `
Visit https://reachable.com and https://unreachable.example.com
`;
    const mockFetch = async (url: string) => !url.includes("unreachable");
    const result = await checkUrlReachability(md, mockFetch);

    expect(result.totalUrls).toBe(2);
    expect(result.reachableCount).toBe(1);
    expect(result.unreachableUrls).toEqual(["https://unreachable.example.com"]);
  });

  it("should handle markdown with no URLs", async () => {
    const md = `# No links here`;
    const mockFetch = async () => true;
    const result = await checkUrlReachability(md, mockFetch);

    expect(result.totalUrls).toBe(0);
    expect(result.reachableCount).toBe(0);
    expect(result.unreachableUrls).toHaveLength(0);
  });

  it("should handle all URLs being unreachable", async () => {
    const md = `
Visit https://dead1.example.com and https://dead2.example.com
`;
    const mockFetch = async () => false;
    const result = await checkUrlReachability(md, mockFetch);

    expect(result.totalUrls).toBe(2);
    expect(result.reachableCount).toBe(0);
    expect(result.unreachableUrls).toHaveLength(2);
  });
});

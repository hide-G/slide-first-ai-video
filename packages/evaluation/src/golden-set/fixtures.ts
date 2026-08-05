import { GoldenSetFixture } from "../types.js";

/**
 * 10 representative LT themes covering diverse topics for quality evaluation.
 */
export const goldenSetFixtures: GoldenSetFixture[] = [
  {
    id: "gs-001",
    theme: "technical-explanation",
    audience: "backend engineers",
    duration: 5,
    urls: [
      "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html",
      "https://nodejs.org/en/docs",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "revolutionary",
      "game-changing",
      "silver bullet",
      "absolutely the best",
    ],
    expectedSlideCountRange: [5, 10],
  },
  {
    id: "gs-002",
    theme: "new-feature-intro",
    audience: "full-stack developers",
    duration: 5,
    urls: [
      "https://react.dev/blog",
      "https://developer.mozilla.org/en-US/docs/Web",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "everyone knows",
      "obviously",
      "no brainer",
      "guaranteed",
    ],
    expectedSlideCountRange: [5, 10],
  },
  {
    id: "gs-003",
    theme: "case-study",
    audience: "engineering managers",
    duration: 7,
    urls: [
      "https://aws.amazon.com/solutions/case-studies/",
      "https://www.infoq.com/articles/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "unprecedented",
      "world-class",
      "industry-leading",
      "magical",
    ],
    expectedSlideCountRange: [6, 12],
  },
  {
    id: "gs-004",
    theme: "comparison",
    audience: "software architects",
    duration: 5,
    urls: [
      "https://docs.docker.com/get-started/",
      "https://kubernetes.io/docs/home/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "clearly superior",
      "always better",
      "never use",
      "perfect solution",
    ],
    expectedSlideCountRange: [5, 10],
  },
  {
    id: "gs-005",
    theme: "tutorial",
    audience: "junior developers",
    duration: 7,
    urls: [
      "https://docs.github.com/en/actions",
      "https://vitest.dev/guide/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "trivial",
      "simply",
      "just do",
      "any fool can",
    ],
    expectedSlideCountRange: [6, 12],
  },
  {
    id: "gs-006",
    theme: "architecture-overview",
    audience: "platform engineers",
    duration: 7,
    urls: [
      "https://aws.amazon.com/architecture/well-architected/",
      "https://martinfowler.com/articles/microservices.html",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "infinitely scalable",
      "zero downtime guaranteed",
      "eliminates all",
      "flawless",
    ],
    expectedSlideCountRange: [6, 12],
  },
  {
    id: "gs-007",
    theme: "best-practices",
    audience: "DevOps engineers",
    duration: 5,
    urls: [
      "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html",
      "https://12factor.net/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "the only way",
      "must always",
      "never ever",
      "universally true",
    ],
    expectedSlideCountRange: [5, 10],
  },
  {
    id: "gs-008",
    theme: "migration-guide",
    audience: "tech leads",
    duration: 7,
    urls: [
      "https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/migration-patterns.html",
      "https://docs.microsoft.com/en-us/azure/cloud-adoption-framework/migrate/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "painless migration",
      "zero risk",
      "effortless",
      "instant results",
    ],
    expectedSlideCountRange: [6, 12],
  },
  {
    id: "gs-009",
    theme: "tool-introduction",
    audience: "frontend developers",
    duration: 5,
    urls: [
      "https://vitejs.dev/guide/",
      "https://turbo.build/repo/docs",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "kills all competitors",
      "only tool you need",
      "replaces everything",
      "absolutely perfect",
    ],
    expectedSlideCountRange: [5, 10],
  },
  {
    id: "gs-010",
    theme: "performance-optimization",
    audience: "senior engineers",
    duration: 5,
    urls: [
      "https://web.dev/performance/",
      "https://developer.chrome.com/docs/devtools/",
    ],
    expectedStructure: {
      problem: true,
      solution: true,
      evidence: true,
      summary: true,
    },
    prohibitedExpressions: [
      "always faster",
      "eliminates all latency",
      "infinite performance",
      "guaranteed 100x",
    ],
    expectedSlideCountRange: [5, 10],
  },
];

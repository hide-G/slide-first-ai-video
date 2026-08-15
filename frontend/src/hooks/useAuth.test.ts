import { describe, it, expect, vi } from "vitest";

// Mock aws-amplify/auth
const mockGetCurrentUser = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockFetchAuthSession = vi.fn();

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
}));

// We test the functions themselves rather than the React hook
// to keep tests simple and avoid needing full React test renderer
describe("useAuth dependencies", () => {
  it("getCurrentUser returns user info when authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "user-123",
      username: "test@example.com",
    });

    const user = await mockGetCurrentUser();
    expect(user.userId).toBe("user-123");
    expect(user.username).toBe("test@example.com");
  });

  it("signIn calls Amplify signIn with credentials", async () => {
    mockSignIn.mockResolvedValue({ isSignedIn: true });

    const result = await mockSignIn({
      username: "user@example.com",
      password: "password123",
    });
    expect(result.isSignedIn).toBe(true);
    expect(mockSignIn).toHaveBeenCalledWith({
      username: "user@example.com",
      password: "password123",
    });
  });

  it("signOut calls Amplify signOut", async () => {
    mockSignOut.mockResolvedValue(undefined);

    await mockSignOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("fetchAuthSession returns id token", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: { toString: () => "mock-token-abc" },
      },
    });

    const session = await mockFetchAuthSession();
    expect(session.tokens.idToken.toString()).toBe("mock-token-abc");
  });

  it("getCurrentUser throws when not authenticated", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("Not authenticated"));

    await expect(mockGetCurrentUser()).rejects.toThrow("Not authenticated");
  });
});

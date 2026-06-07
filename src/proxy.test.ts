import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntlMiddleware = vi.fn().mockImplementation(() => {
  return NextResponse.next();
});

// Assign to globalThis so the hoisted mock can access it during module loading
const globalWithMock = globalThis as typeof globalThis & {
  mockIntlMiddleware: typeof mockIntlMiddleware;
};
globalWithMock.mockIntlMiddleware = mockIntlMiddleware;

vi.mock("next-intl/middleware", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return (req: NextRequest) => {
        const globalWithMock = globalThis as typeof globalThis & {
          mockIntlMiddleware: (r: NextRequest) => NextResponse;
        };
        return globalWithMock.mockIntlMiddleware(req);
      };
    }),
  };
});

// Import proxy after vi.mock and global assignment
import { proxy } from "./proxy";

describe("proxy middleware", () => {
  beforeEach(() => {
    mockIntlMiddleware.mockClear();
  });

  it("allows unauthenticated requests to unprotected routes", () => {
    const req = new NextRequest("http://localhost:3000/");
    proxy(req);
    expect(mockIntlMiddleware).toHaveBeenCalledWith(req);
  });

  it("redirects unauthenticated requests to protected route /profile", () => {
    const req = new NextRequest("http://localhost:3000/profile");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?from=%2Fprofile",
    );
  });

  it("redirects unauthenticated requests to community route /communities", () => {
    const req = new NextRequest("http://localhost:3000/communities");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?from=%2Fcommunities",
    );
  });

  it("redirects unauthenticated requests to community sub-route", () => {
    const req = new NextRequest(
      "http://localhost:3000/communities/join/some-token",
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?from=%2Fcommunities%2Fjoin%2Fsome-token",
    );
  });

  it("redirects unauthenticated requests to Spanish community sub-route", () => {
    const req = new NextRequest(
      "http://localhost:3000/es/communities/join/some-token",
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/es/login?from=%2Fcommunities%2Fjoin%2Fsome-token",
    );
  });

  it("allows authenticated requests to protected route /profile", () => {
    const req = new NextRequest("http://localhost:3000/profile");
    req.cookies.set("better-auth.session_token", "valid-token");
    proxy(req);
    expect(mockIntlMiddleware).toHaveBeenCalledWith(req);
  });

  it("allows authenticated requests to community route /communities", () => {
    const req = new NextRequest("http://localhost:3000/communities");
    req.cookies.set("better-auth.session_token", "valid-token");
    proxy(req);
    expect(mockIntlMiddleware).toHaveBeenCalledWith(req);
  });
});

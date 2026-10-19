import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const session = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isProtected =
    pathname.startsWith("/learn") ||
    pathname.startsWith("/teach") ||
    pathname.startsWith("/profile");
  const isTeach = pathname.startsWith("/teach");

  if (isProtected && !session) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  // Role enforcement for /teach happens server-side in the layout; cookie presence is optimistic only.
  if (isTeach) {
    // placeholder: real role check in server component
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/learn/:path*", "/teach/:path*", "/profile/:path*", "/sign-in", "/sign-up"],
};

import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const { pathname } = req.nextUrl

  // Protect /app/* routes
  if (pathname.startsWith('/app') && !token) {
    const authUrl = new URL('/auth', req.url)
    authUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(authUrl)
  }

  // Redirect authenticated users away from /auth
  if (pathname === '/auth' && token) {
    return NextResponse.redirect(new URL('/app', req.url))
  }

  // Redirect root to /app (middleware handles auth check above)
  if (pathname === '/') {
    return NextResponse.redirect(new URL(token ? '/app' : '/auth', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/auth', '/app/:path*'],
}

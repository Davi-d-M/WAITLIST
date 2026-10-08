import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^OB-[A-F0-9]{8}$/i.test(code)) {
    return NextResponse.redirect(new URL('/', request.url), 307);
  }
  const destination = new URL('/', request.url);
  destination.searchParams.set('ref', code.toUpperCase());
  return NextResponse.redirect(destination, 307);
}

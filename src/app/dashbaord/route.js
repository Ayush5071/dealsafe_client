import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.redirect(new URL('/dashboard', 'http://localhost:3000'));
}
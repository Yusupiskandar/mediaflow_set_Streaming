import { NextResponse } from 'next/server';
import { getUserCount } from '@/lib/db';

export async function GET() {
  try {
    const count = getUserCount();
    return NextResponse.json({ setupRequired: count === 0 });
  } catch (error) {
    console.error('Check setup status error:', error);
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}

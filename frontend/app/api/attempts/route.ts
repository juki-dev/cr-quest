import type { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backendProxy';

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyToBackend('/api/attempts', { method: 'POST', body });
}

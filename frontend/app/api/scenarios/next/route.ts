import { proxyToBackend } from '@/lib/backendProxy';

export async function GET() {
  return proxyToBackend('/api/scenarios/next');
}

import published from '../../../reverse-engineering-examples.json';
import { ReverseEngineeringExampleCatalog } from '../../../lib/core/reverse-engineering';

/** Public proof endpoint: only versioned, human-reviewed library records. */
export function GET(): Response {
  return Response.json({ examples: ReverseEngineeringExampleCatalog.parse(published) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

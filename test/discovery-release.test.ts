import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { GET } from '../site/app/api/reverse-engineering-examples/route';
import { ReverseEngineeringExampleCatalog } from '../src/core/reverse-engineering';

describe('discovery release contract', () => {
  it('keeps local migration identities aligned with the applied production history', () => {
    expect(existsSync('supabase/migrations/20261014214826_hardware_discovery.sql')).toBe(true);
    expect(existsSync('supabase/migrations/20261014220216_discovery_evidence_resolution.sql')).toBe(true);
  });
  it('serves only the published catalog, not private discoveries', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    const published = JSON.parse(readFileSync('reverse-engineering-examples.json', 'utf8'));
    expect(ReverseEngineeringExampleCatalog.parse(body.examples)).toEqual(published);
    expect(body).not.toHaveProperty('candidates');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('schedules only trusted-main runs with bounded permissions and duration', () => {
    const workflow = readFileSync('.github/workflows/hardware-discovery.yml', 'utf8');
    expect(workflow).toContain('cron: "17 7 * * *"');
    expect(workflow).toContain('timezone: "America/Chicago"');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('SUPABASE_SECRET_KEY');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('npm run discovery:run -- --live');
    expect(workflow).toContain('DISCOVERY_PIPELINE_ENABLED: ${{ vars.DISCOVERY_PIPELINE_ENABLED }}');
    expect(workflow).toContain('actions/setup-python@v5');
    for (const key of ['GROKBOT_WEBHOOK_URL', 'GROKBOT_WEBHOOK_SECRET', 'GROKBOT_RELAY_URL', 'GROKBOT_RELAY_READ_SECRET', 'GROKBOT_CALLBACK_SECRET']) {
      expect(workflow).toContain(`${key}: \${{ secrets.${key} }}`);
    }
    expect(workflow).toContain('GROKBOT_WEBHOOK_STATE_DIR: ${{ runner.temp }}/grokbot-webhook');
    expect(workflow).not.toMatch(/AI_GATEWAY|DISCOVERY_GROK_MODEL|DISCOVERY_GROK_CAPS/);
  });
  it('checks the actual database policy and website build before release', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('DISCOVERY_TEST_DATABASE_URL');
    expect(workflow).toContain('55437:5432');
    expect(workflow).toContain('npm run build --prefix site');
  });
  it('allows discovery without activating a publisher blocked by organization policy', () => {
    const workflow = readFileSync('.github/workflows/promote-hardware-discoveries.yml', 'utf8');
    expect(workflow).toContain("vars.DISCOVERY_PUBLISHER_ENABLED == 'true'");
  });
});

import { describe, expect, it } from 'vitest';
import { renderPage } from '../src/page.js';

describe('agent page', () => {
  it('renders the disclosure, channels and escapes untrusted text', () => {
    const html = renderPage({ name: 'a9n9 agent', handle: 'agent001', about: 'not a person <script>', npub: 'npub1x', digestDay: '2026-11-01', channels: [{ label: 'Email', value: 'a@b.c', href: 'mailto:a@b.c' }, { label: 'Nostr', value: 'npub1x' }] });
    expect(html).toContain('not a person &lt;script&gt;');
    expect(html).toContain('mailto:a@b.c');
    expect(html).toContain('id="chat"');
    expect(html).toContain('/ledger.json');
    expect(html).not.toContain('<script>alert');
  });
});

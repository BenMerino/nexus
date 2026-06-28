import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BaseBox, BaseText } from '../ui/primitives';
import { SegmentedControl } from '../ui/composed/SegmentedControl';
import { GraphProviders } from '../ui/graph-engine-providers';
import { PrimitivesSection, ComposedSection, ConcentricSection } from './dna-sections';

/* /dna — the live DNA catalog. Renders the vendored Zincro primitives + composed
 * components against nexus's token contract (dna-defaults.css + dna-bridge.css),
 * so this page is also the visual proof the contract resolves. Wrapped in
 * GraphProviders for the single DNA/accent control point. */

type Tab = 'primitives' | 'composed' | 'concentric';

function Gallery() {
  const [tab, setTab] = useState<Tab>('primitives');
  return (
    <BaseBox display="flex" flexDirection="col" gap="6"
      style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <BaseBox display="flex" flexDirection="col" gap="2">
        <BaseText as="h1" variant="display">Nexus DNA Catalog</BaseText>
        <BaseText variant="body" color="muted">
          Live renders of the vendored Zincro primitives + composed components,
          themed via the nexus token contract. Toggle OS dark/light to verify the
          theme flows through.
        </BaseText>
      </BaseBox>
      <SegmentedControl<Tab>
        segments={[
          { value: 'primitives', label: 'Primitives' },
          { value: 'composed', label: 'Composed' },
          { value: 'concentric', label: 'Concentric' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'primitives' ? <PrimitivesSection />
        : tab === 'composed' ? <ComposedSection />
        : <ConcentricSection />}
    </BaseBox>
  );
}

const el = document.getElementById('dna-mount');
if (el) {
  createRoot(el).render(
    <GraphProviders tenantId="utalca">
      <Gallery />
    </GraphProviders>,
  );
}

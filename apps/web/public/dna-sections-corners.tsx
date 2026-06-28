import React from 'react';
import { BaseBox, BaseText, BaseAction } from '../ui/primitives';
import { ListItem } from '../ui/composed/ListItem';
import { Row } from './dna-sections';

/* DNA catalog — the corner + surface sections: concentric corners and the
 * glass + tonal-stacking system. Split from dna-sections.tsx for N5 (≤150). */

export function ConcentricSection() {
  return (
    <div>
      <Row title="Concentric corners — nest-controls surface (corners curve parallel to the card)">
        <BaseBox radius="card" pad="row" className="nest-controls"
          display="flex" flexDirection="col" gap="1"
          style={{ width: '320px', border: '1px solid var(--border)' }}>
          <ListItem as="button" leftIcon={<span>◆</span>}>Publications</ListItem>
          <ListItem as="button" active leftIcon={<span>◆</span>}>Per academic</ListItem>
          <ListItem as="button" leftIcon={<span>◆</span>}>Citations</ListItem>
          <BaseAction variant="primary" size="sm">Action inside the card</BaseAction>
        </BaseBox>
      </Row>
      <Row title="Flat control (no nest-controls) — square/control radius for contrast">
        <BaseBox radius="card" pad="row" display="flex" flexDirection="col" gap="1"
          style={{ width: '320px', border: '1px solid var(--border)' }}>
          <BaseAction variant="secondary" size="sm">Same card, no nest-controls</BaseAction>
        </BaseBox>
      </Row>
      <BaseText variant="detail" color="muted">
        The card has radius="card" + pad="row"; BaseBox publishes --_nest-r/-pad, and
        nest-controls makes descendants read the concentric corner (card radius −
        inset − border). corner-shape: superellipse(1.6) renders them as squircles.
      </BaseText>
    </div>
  );
}

export function GlassSection() {
  return (
    <div>
      <Row title="Glass surfaces + tonal stacking — each nested layer is a new shade">
        <div className="surface" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-card)', width: '420px' }}>
          <BaseText variant="label" color="muted">Surface · rung 1</BaseText>
          <div className="surface" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-card)', marginTop: 'var(--space-2)' }}>
            <BaseText variant="label" color="muted">Nested · rung 2</BaseText>
            <div className="surface" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-card)', marginTop: 'var(--space-2)' }}>
              <BaseText variant="label" color="muted">Nested deeper · rung 3</BaseText>
              <BaseText variant="body">Text stays sharp above the grain.</BaseText>
            </div>
          </div>
        </div>
      </Row>
      <BaseText variant="detail" color="muted">
        Every .surface is translucent glass (a tint of --bg + backdrop-filter blur +
        grain). Nesting steps the tonal ladder (--glass-1 → 2 → 3, derived from --bg
        mixed toward --fg) so each stacked layer reads as a distinct shade — in light
        AND dark, following the live theme.
      </BaseText>
    </div>
  );
}

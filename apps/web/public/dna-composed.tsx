import React, { useState } from 'react';
import { BaseBox, BaseText, BaseAction } from '../ui/primitives';
import { Row } from './dna-sections';
import { Button } from '../ui/composed/Button';
import { SegmentedControl } from '../ui/composed/SegmentedControl';
import { Popover } from '../ui/composed/Popover';
import { PopoverTrigger } from '../ui/composed/PopoverTrigger';
import { SearchField } from '../ui/composed/SearchField';
import { MultiSelectPanel } from '../ui/composed/MultiSelectPanel';
import { SingleSelectPanel } from '../ui/composed/SingleSelectPanel';
import { ListItem } from '../ui/composed/ListItem';
import { Disclosure } from '../ui/composed/Disclosure';
import { FilterTrigger } from '../ui/composed/FilterTrigger';
import { LiveBadge } from '../ui/composed/LiveBadge';
import { LiquidGlass } from './liquid-glass-wrap';

const SELECT_OPTS = [
  { value: 'crossref', label: 'CrossRef' },
  { value: 'openalex', label: 'OpenAlex' },
  { value: 'datacite', label: 'DataCite' },
  { value: 'semantic', label: 'Semantic Scholar' },
];

export function ComposedSection() {
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  const [search, setSearch] = useState('');
  const [multi, setMulti] = useState<string[]>(['crossref', 'openalex']);
  const [single, setSingle] = useState('openalex');
  return (
    <div>
      <Row title="Button (composed) — variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </Row>
      <Row title="SegmentedControl — through liquid-dom glass (where supported)">
        <LiquidGlass cornerRadius={9}>
          <SegmentedControl<'day' | 'week' | 'month'>
            segments={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            value={seg}
            onChange={setSeg}
          />
        </LiquidGlass>
      </Row>
      <Row title="Popover (the composition engine)">
        <Popover
          trigger={({ toggle, ref }) => (
            <BaseAction ref={ref as any} variant="secondary" onClick={toggle}>Open popover</BaseAction>
          )}
        >
          {(close) => (
            <BaseBox display="flex" flexDirection="col" gap="2" p="4"
              style={{ minWidth: '200px' }}>
              <BaseText variant="body">Popover panel content.</BaseText>
              <BaseText variant="detail" color="muted">
                Viewport-aware, edge-flip, glass reveal.
              </BaseText>
              <BaseAction variant="primary" size="sm" onClick={close}>Close</BaseAction>
            </BaseBox>
          )}
        </Popover>
      </Row>

      <Row title="PopoverTrigger">
        <PopoverTrigger
          label="Sources"
          panel={() => (
            <BaseBox p="3" style={{ minWidth: '180px' }}>
              <BaseText variant="detail" color="muted">Trigger-bound popover.</BaseText>
            </BaseBox>
          )}
        />
      </Row>

      <Row title="SearchField">
        <div style={{ width: 280 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search sources…" />
        </div>
      </Row>

      <Row title="FilterTrigger + MultiSelectPanel">
        <FilterTrigger label="Sources" badge={multi.length}>
          {() => (
            <MultiSelectPanel options={SELECT_OPTS} selected={multi} onChange={setMulti} bare />
          )}
        </FilterTrigger>
      </Row>

      <Row title="SingleSelectPanel">
        <div style={{ width: 240 }}>
          <SingleSelectPanel options={SELECT_OPTS} value={single} onChange={setSingle} searchable />
        </div>
      </Row>

      <Row title="ListItem">
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ListItem selectable active>CrossRef · active</ListItem>
          <ListItem selectable>OpenAlex</ListItem>
          <ListItem selectable disabled>DataCite · disabled</ListItem>
        </div>
      </Row>

      <Row title="Disclosure">
        <div style={{ width: 360 }}>
          <Disclosure label="Indexation flags" summary="3 enabled">
            <BaseText variant="detail" color="muted">is_core · is_in_doaj · is_in_scielo</BaseText>
          </Disclosure>
        </div>
      </Row>

      <Row title="LiveBadge">
        <LiveBadge active label="live" />
        <LiveBadge active={false} label="paused" />
      </Row>
    </div>
  );
}

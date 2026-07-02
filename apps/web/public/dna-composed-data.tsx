import React, { useState } from 'react';
import { BaseBox, BaseText } from '../ui/primitives';
import { Row } from './dna-sections';
import { PanelSurface } from '../ui/composed/PanelSurface';
import { ListItem } from '../ui/composed/ListItem';
import { SearchField } from '../ui/composed/SearchField';
import { UnavailableHint } from '../ui/composed/UnavailableHint';
import { SegmentedPill } from '../ui/composed/SegmentedPill';
import { TableSelectionToggle } from '../ui/composed/TableSelectionToggle';
import { DateRangePicker, type DateRangeValue } from '../ui/composed/DateRangePicker';
import { ActionMenu } from '../ui/composed/ActionMenu';
import { QuickCalendar } from '../ui/composed/QuickCalendar';
import { ColorSwatchItem } from '../ui/composed/ColorSwatchItem';

/* Third composed section — the data / list / calendar composites: PanelSurface
 * (the floating list shell), DateRangePicker, ActionMenu, QuickCalendar,
 * SegmentedPill, TableSelectionToggle, UnavailableHint, ColorSwatchItem. Split
 * from the other two composed files to stay under N5. */

// A fixed reference date so the calendar renders deterministically (no Date.now).
const REF_DATE = new Date('2026-07-02T00:00:00');

export function ComposedDataSection() {
  const [pill, setPill] = useState('all');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ preset: 'last-30', start: '2026-06-02', end: '2026-07-02' });
  const [swatch, setSwatch] = useState('#f59e0b');
  return (
    <div>
      <Row title="PanelSurface (the floating list shell)">
        <PanelSurface width="280px" maxHeight="180px" controlSize="sm"
          header={<SearchField value={q} onChange={setQ} placeholder="Filter sources…" />}
          footer={<BaseText variant="micro" color="muted">4 sources</BaseText>}>
          <ListItem selectable active>CrossRef</ListItem>
          <ListItem selectable>OpenAlex</ListItem>
          <ListItem selectable>DataCite</ListItem>
          <ListItem selectable>Semantic Scholar</ListItem>
        </PanelSurface>
      </Row>
      <Row title="SegmentedPill">
        <SegmentedPill
          options={[{ value: 'all', label: 'All' }, { value: 'core', label: 'Core' }, { value: 'doaj', label: 'DOAJ' }]}
          value={pill} onChange={setPill} />
      </Row>
      <Row title="DateRangePicker">
        <DateRangePicker value={range} onChange={setRange} />
      </Row>
      <Row title="TableSelectionToggle">
        <TableSelectionToggle pageSelected={25} totalCount={193} allAcrossPages={false}
          onSelectAll={() => {}} onClear={() => {}} itemLabel="record" />
      </Row>
      <Row title="ActionMenu (inline)">
        <BaseBox style={{ width: 200, position: 'relative' }}>
          <ActionMenu>
            <ActionMenu.Item onClick={() => {}}>Open</ActionMenu.Item>
            <ActionMenu.Item onClick={() => {}}>Rename</ActionMenu.Item>
            <ActionMenu.Divider />
            <ActionMenu.Item variant="danger" onClick={() => {}}>Delete</ActionMenu.Item>
          </ActionMenu>
        </BaseBox>
      </Row>
      <Row title="UnavailableHint / ColorSwatchItem">
        <UnavailableHint reason="Beyond data range" />
        <BaseBox display="flex" gap="2">
          {['#f59e0b', '#6b6b6b', '#ef4444'].map(c => (
            <ColorSwatchItem key={c} color={c} selected={swatch === c} onSelect={setSwatch} />
          ))}
        </BaseBox>
      </Row>
      <Row title="QuickCalendar">
        <BaseBox style={{ width: 280 }}>
          <QuickCalendar currentDate={REF_DATE} view="monthly" onSelectDate={() => {}} />
        </BaseBox>
      </Row>
    </div>
  );
}

import React, { useState } from 'react';
import { BaseBox, BaseText, BaseIcon, BaseAction } from '../ui/primitives';
import { Row } from './dna-sections';
import { Info } from '../ui/icons';
import { Toggle } from '../ui/composed/Toggle';
import { Select } from '../ui/composed/Select';
import { NumberField } from '../ui/composed/NumberField';
import { ColorField } from '../ui/composed/ColorField';
import { DangerPill } from '../ui/composed/DangerPill';
import { CopyButton } from '../ui/composed/CopyButton';
import { SyncIndicator } from '../ui/composed/SyncIndicator';
import { InfoPopover } from '../ui/composed/InfoPopover';
import { Dropdown } from '../ui/composed/Dropdown';
import { FilterMenu } from '../ui/composed/FilterMenu';
import { DatePicker } from '../ui/composed/DatePicker';
import { TimePicker } from '../ui/composed/TimePicker';
import { TablePagination } from '../ui/composed/TablePagination';
import { BaseModal } from '../ui/composed/BaseModal';
import { ConfirmationModal } from '../ui/composed/ConfirmationModal';

/* Second composed section — the generic form / overlay / date DNA vendored from
 * Zincro (Toggle, Select, NumberField, ColorField, Dropdown, FilterMenu,
 * DatePicker, modals…). Split from dna-composed.tsx to stay under N5. */

const SRC_OPTS = [
  { value: 'crossref', label: 'CrossRef' },
  { value: 'openalex', label: 'OpenAlex' },
  { value: 'datacite', label: 'DataCite' },
];

export function ComposedFormsSection() {
  const [on, setOn] = useState(true);
  const [sel, setSel] = useState('openalex');
  const [num, setNum] = useState('12');
  const [color, setColor] = useState('#f59e0b');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:30');
  const [page, setPage] = useState(1);
  const [filt, setFilt] = useState<string[]>(['crossref']);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <Row title="Toggle">
        <Toggle checked={on} onChange={setOn} />
        <Toggle checked={!on} onChange={v => setOn(!v)} size="sm" />
        <Toggle checked disabled onChange={() => {}} />
      </Row>
      <Row title="Select">
        <div style={{ width: 220 }}>
          <Select value={sel} onChange={setSel} options={SRC_OPTS} />
        </div>
      </Row>
      <Row title="NumberField / ColorField">
        <div style={{ width: 140 }}>
          <NumberField value={num} onChange={setNum} unit="mo" min={0} />
        </div>
        <div style={{ width: 200 }}>
          <ColorField label="Accent" value={color} onChange={setColor} />
        </div>
      </Row>
      <Row title="DatePicker / TimePicker">
        <div style={{ width: 220 }}>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div style={{ width: 160 }}>
          <TimePicker value={time} onChange={setTime} />
        </div>
      </Row>
      <Row title="Dropdown (compound)">
        <Dropdown>
          <Dropdown.Trigger><BaseAction variant="secondary">Actions</BaseAction></Dropdown.Trigger>
          <Dropdown.Panel>
            <Dropdown.Item onClick={() => {}}>Rename</Dropdown.Item>
            <Dropdown.Item onClick={() => {}}>Duplicate</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item variant="danger" onClick={() => {}}>Delete</Dropdown.Item>
          </Dropdown.Panel>
        </Dropdown>
      </Row>
      <Row title="FilterMenu">
        <FilterMenu
          activeCount={filt.length}
          sections={[{
            key: 'src', label: 'Sources', options: SRC_OPTS,
            selected: filt, onChange: setFilt,
          }]}
        />
      </Row>
      <Row title="InfoPopover / DangerPill / CopyButton / SyncIndicator">
        <InfoPopover glyph={<BaseIcon icon={Info} size="sm" />}>
          <BaseText variant="detail">Contextual help panel, viewport-aware.</BaseText>
        </InfoPopover>
        <DangerPill>Unsaved changes</DangerPill>
        <CopyButton text="10.1000/xyz" />
        <SyncIndicator />
        <SyncIndicator slow />
        <SyncIndicator error />
      </Row>
      <Row title="TablePagination">
        <TablePagination page={page} pageCount={8} totalCount={193} pageSize={25}
          onPageChange={setPage} itemLabel="record" />
      </Row>
      <Row title="Modals">
        <BaseText as="button" variant="detail" onClick={() => setModal(true)}
          style={{ cursor: 'pointer', textDecoration: 'underline' }}>Open BaseModal</BaseText>
        <BaseText as="button" variant="detail" onClick={() => setConfirm(true)}
          style={{ cursor: 'pointer', textDecoration: 'underline' }}>Open ConfirmationModal</BaseText>
        <BaseModal isOpen={modal} onClose={() => setModal(false)} title="Base modal">
          <BaseBox p="4"><BaseText variant="body">Modal body content.</BaseText></BaseBox>
        </BaseModal>
        <ConfirmationModal isOpen={confirm} onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)} title="Delete record?"
          message="This cannot be undone." confirmLabel="Delete" type="danger" />
      </Row>
    </div>
  );
}

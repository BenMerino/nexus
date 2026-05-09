import React from 'react';
import { parseLabel, type LabelRun } from './rich-label';

/** HTML-side render of a rich label — emits <i>, <b>, <sub>, <sup> around
 *  each styled run. Use inside HTML elements (divs, headings). For SVG
 *  <text>, use the RichText component in community-graph/label-runs.tsx. */
export function RichHtml({ raw }: { raw: string }) {
  const runs = parseLabel(raw);
  return (
    <>
      {runs.map((r, i) => <Run key={i} run={r} />)}
    </>
  );
}

function Run({ run }: { run: LabelRun }) {
  let el: React.ReactNode = run.text;
  if (run.italic) el = <i>{el}</i>;
  if (run.bold) el = <b>{el}</b>;
  if (run.sub) el = <sub>{el}</sub>;
  if (run.sup) el = <sup>{el}</sup>;
  return <>{el}</>;
}

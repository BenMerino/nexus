import React from 'react';
import { ChartPanel } from './tenant-panel';
import { ES } from './tenant-i18n';

/* Empty-state panel for a section whose only leaves are unbuilt ('soon'). Keeps
 * the roadmap visible inside the content area when such a section is reachable
 * (today none are — every all-`soon` section is disabled in the nav — but this
 * guards the router so a future live+soon mix can render the soon leaf's frame).
 * The chrome/frame is the shared ChartPanel; this is just the message. */

export function SectionPlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="chart-grid">
      <ChartPanel className="full" title={title} tag={ES.sidebar.comingSoon}>
        <div className="section-placeholder">
          {note || ES.placeholder.notAvailable}
        </div>
      </ChartPanel>
    </div>
  );
}

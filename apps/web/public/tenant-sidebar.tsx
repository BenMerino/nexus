import React from 'react';
import { ES } from './tenant-i18n';
import { NAV_SECTIONS, sectionIsLive, type NavSection } from './tenant-sections';

/* The public profile's left navigation: the 6 IA sections, each expanding to
 * its leaves. Replaces the old scope rail as the left control (unit scoping
 * now lives in the in-view dropdown, tenant-unit-filter). A section/leaf marked
 * 'soon' is shown but disabled with a "Coming soon" tag — the roadmap stays
 * visible, the dead links don't fire. Chrome (the floating glass) is the shared
 * shell (N9); this adds only the page-specific nav list. */

function Leaf({ label, status, active, onClick }: {
  label: string; status: 'live' | 'soon'; active: boolean; onClick: () => void;
}) {
  if (status === 'soon') {
    return (
      <div className="nav-leaf soon" aria-disabled="true">
        <span className="nav-leaf-label">{label}</span>
        <span className="nav-leaf-tag">{ES.sidebar.comingSoon}</span>
      </div>
    );
  }
  return (
    <div className={`nav-leaf${active ? ' active' : ''}`} onClick={onClick}>
      <span className="nav-leaf-label">{label}</span>
    </div>
  );
}

function Section({ section, activeSection, activeLeaf, onSelect }: {
  section: NavSection;
  activeSection: string;
  activeLeaf: string | null;
  onSelect: (sectionId: string, leafId: string) => void;
}) {
  const live = sectionIsLive(section);
  return (
    <div className={`nav-section${live ? '' : ' soon'}`}>
      <h3 className="nav-section-title">{section.label}</h3>
      <div className="nav-section-leaves">
        {section.leaves.map(leaf => (
          <Leaf key={leaf.id} label={leaf.label} status={leaf.status}
            active={activeSection === section.id && activeLeaf === leaf.id}
            onClick={() => onSelect(section.id, leaf.id)} />
        ))}
      </div>
    </div>
  );
}

export function TenantSidebar({ activeSection, activeLeaf, onSelect }: {
  activeSection: string;
  activeLeaf: string | null;
  onSelect: (sectionId: string, leafId: string) => void;
}) {
  return (
    <nav className="tenant-sidebar" aria-label="Sections">
      {NAV_SECTIONS.map(section => (
        <Section key={section.id} section={section}
          activeSection={activeSection} activeLeaf={activeLeaf} onSelect={onSelect} />
      ))}
    </nav>
  );
}

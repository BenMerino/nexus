import React from 'react';

const S = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;

export const Ico = {
  home:   <svg {...S}><path d="M4 11 L12 4 L20 11 L20 20 L14 20 L14 14 L10 14 L10 20 L4 20 Z"/></svg>,
  graph:  <svg {...S}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="7.4" y1="7.4" x2="10.8" y2="16.6"/><line x1="16.6" y1="7.4" x2="13.2" y2="16.6"/><line x1="8" y1="6" x2="16" y2="6"/></svg>,
  paper:  <svg {...S}><path d="M6 3 H15 L19 7 V21 H6 Z"/><line x1="9" y1="9" x2="16" y2="9"/><line x1="9" y1="13" x2="16" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  people: <svg {...S}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20 C3 16 5 14 9 14 C13 14 15 16 15 20"/><path d="M14 20 C14 17 15.5 15.5 18 15.5 C20.5 15.5 22 17 22 20"/></svg>,
  build:  <svg {...S}><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>,
  submit: <svg {...S}><line x1="12" y1="4" x2="12" y2="16"/><polyline points="7,9 12,4 17,9"/><line x1="4" y1="20" x2="20" y2="20"/></svg>,
  search: <svg {...S}><circle cx="10" cy="10" r="6"/><line x1="14.5" y1="14.5" x2="20" y2="20"/></svg>,
  gear:   <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M12 2 L13 5 L16 4 L16 7 L19 8 L18 11 L21 12 L18 13 L19 16 L16 17 L16 20 L13 19 L12 22 L11 19 L8 20 L8 17 L5 16 L6 13 L3 12 L6 11 L5 8 L8 7 L8 4 L11 5 Z"/></svg>,
  tag:    <svg {...S}><path d="M3 12 L12 3 L21 3 L21 12 L12 21 Z"/><circle cx="16" cy="8" r="1.4"/></svg>,
  close:  <svg {...S}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>,
  arrow:  <svg {...S} strokeWidth={1.8}><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14,6 20,12 14,18"/></svg>,
  back:   <svg {...S} strokeWidth={1.8}><line x1="20" y1="12" x2="4" y2="12"/><polyline points="10,6 4,12 10,18"/></svg>,
  check:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="4,12 10,18 20,6"/></svg>,
  ext:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 17 L17 7"/><polyline points="9,7 17,7 17,15"/></svg>,
};

export type IcoKey = keyof typeof Ico;

import React from 'react';
import { Skeleton } from '../ui/primitives';

/** Hero placeholder while the profile fetch is in flight. Lives beside
 *  author-profile.tsx and is attached there as AuthorProfile.Skeleton, so it
 *  still travels with the component — split out only because author-profile.tsx
 *  is at the N5 line cap. Built from the Skeleton primitive (single shimmer). */
export function AuthorProfileSkeleton() {
  return (
    <section className="profile-hero" aria-hidden="true">
      <div className="profile-head">
        <Skeleton block className="profile-avatar" width={72} height={72} radius="pill" />
        <div className="profile-id">
          <Skeleton block width={120} height={13} />
          <Skeleton block width={320} height={28} style={{ marginTop: 10 }} />
          <Skeleton block width={220} height={13} style={{ marginTop: 12 }} />
        </div>
      </div>
    </section>
  );
}

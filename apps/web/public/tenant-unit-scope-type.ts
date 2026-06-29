// The scope a selected unit carries — shared by the unit filter (the picker),
// the summary KPIs, the section views, and search. A faculty/institute id plus
// its display name; null elsewhere means whole-organization scope.
export interface UnitScope { unitKey: string; name: string; }

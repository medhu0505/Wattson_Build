// The case is a fixed list of stages, played in this order.
// Clearing a stage unlocks the one after it.
//   id    – used in the web address (#/files) and in saved progress
//   tab   – the number printed on the folder tab
//   title – the name printed on the folder tab

export const STAGES = [
  { id: 'intake',    tab: '00', title: 'Intake' },
  { id: 'files',     tab: '01', title: 'Case Files' },
  { id: 'forensics', tab: '02', title: 'Energy Forensics' },
  { id: 'signal',    tab: '03', title: 'Signal Decoder' },
  { id: 'machine',   tab: '04', title: 'Machine Terminal' },
  { id: 'report',    tab: '05', title: 'Case Report' },
];

// Just the ids, in order: ['intake', 'files', ...]
export const STAGE_IDS = STAGES.map((stage) => stage.id);

// Find a stage by its id. Returns undefined if there is no such stage.
export function getStage(id) {
  return STAGES.find((stage) => stage.id === id);
}

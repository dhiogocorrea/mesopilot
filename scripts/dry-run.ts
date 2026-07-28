import { readWorkbook } from "./parse-pbp";
import { guessEquipment, guessMovementType, guessMuscle } from "./guess-muscle";

/** Parses without touching the database, so the mapping can be eyeballed first. */
void (async () => {
  const path = process.argv[2]!;
  const blocks = await readWorkbook(path);

  for (const block of blocks) {
    const slots = block.days.reduce((t, d) => t + d.slots.length, 0);
    console.log(`\n=== ${block.name}  (${block.days.length} days, ${slots} slots)`);
    for (const day of block.days) {
      console.log(`  ${day.label}`);
      for (const slot of day.slots) {
        const g = guessMuscle(slot.name, day.label);
        console.log(
          `    ${g.confident ? " " : "?"} ${g.muscle.padEnd(11)} ${guessEquipment(slot.name).padEnd(10)} ` +
            `${guessMovementType(slot.name).padEnd(9)} ${slot.workingSets}x${slot.repMin}-${slot.repMax} ` +
            `${String(slot.restSec).padStart(3)}s  ${slot.name}` +
            (slot.supersetGroup ? `  [${slot.supersetGroup}]` : "") +
            (slot.technique ? `  {${slot.technique.slice(0, 24)}}` : ""),
        );
      }
    }
  }
})();

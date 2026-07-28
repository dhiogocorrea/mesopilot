/**
 * Stock tracks: ordered runs of the seeded programs.
 *
 * A track is a macrocycle — several blocks with an arc, run back to back.
 * These are deliberately short and defensible rather than a year-long
 * prescription: each step changes one thing (volume, frequency or intent) so
 * the reason to move on is obvious.
 *
 * `programs` holds ProgramTemplate keys from seed-programs.ts, in order.
 *
 * Those keys point at blocks written *for* these tracks, not at the standalone
 * programs they resemble. A block that belongs to a track is listed only inside
 * it, so building a track out of Upper / Lower 4x would take Upper / Lower 4x
 * out of the library — too high a price for a program that common.
 */
export type TrackSeed = {
  key: string;
  en: string;
  pt: string;
  descEn: string;
  descPt: string;
  programs: string[];
};

export const TRACKS: TrackSeed[] = [
  {
    key: "foundations",
    en: "Foundations",
    pt: "Fundamentos",
    descEn:
      "Learn the barbell lifts, then add the volume that grows muscle. Three blocks, about fifteen weeks.",
    descPt:
      "Aprenda os exercícios de barra e depois adicione o volume que constrói músculo. Três blocos, cerca de quinze semanas.",
    programs: ["foundations_learn", "foundations_volume", "foundations_split"],
  },
  {
    key: "hypertrophy_build",
    en: "Hypertrophy Build",
    pt: "Construção de Hipertrofia",
    descEn:
      "Four days to build the base, then six to push weekly volume where four days cannot reach.",
    descPt:
      "Quatro dias para construir a base e depois seis para levar o volume semanal aonde quatro dias não alcançam.",
    programs: ["hyper_build_base", "hyper_build_volume"],
  },
  {
    key: "powerbuilding_track",
    en: "Strength & Size",
    pt: "Força e Tamanho",
    descEn:
      "Heavy work paired with hypertrophy throughout, ending on one main lift per day. Three blocks.",
    descPt:
      "Trabalho pesado combinado com hipertrofia do início ao fim, terminando com um exercício principal por dia. Três blocos.",
    programs: ["strength_size_base", "strength_size_build", "strength_size_peak"],
  },
  {
    key: "lean_track",
    en: "Lean Out",
    pt: "Definição",
    descEn:
      "Hold your muscle through a deficit: moderate volume first, then higher frequency and shorter sessions.",
    descPt:
      "Mantenha o músculo durante o déficit: volume moderado primeiro e depois mais frequência com treinos curtos.",
    programs: ["lean_out_hold", "lean_out_frequency"],
  },
];

/**
 * Inferred form-demonstration videos, one per exercise.
 *
 * ⚠️ **Nobody has watched these.** Each was chosen by running a web search for
 * the exercise name and picking the result whose *title* matched most exactly,
 * preferring "tutorial / proper form / technique" over listicles and shorts,
 * and skipping near-miss variants (an incline version of a flat lift, a reverse
 * version of a machine). A title is a good signal, not proof: it can
 * misdescribe its video, and videos get deleted or made private.
 *
 * They therefore seed as `demoSource: "inferred"` and show in the app as
 * *Unchecked*, with a filter in the Exercises tab for reviewing them. Anything
 * set in the app becomes `demoSource: "user"` and is never touched again — the
 * seed only ever fills a null `demoUrl`. To re-infer one, clear it in the app.
 *
 * A missing key is safe: it falls back to a search built from the exercise's
 * own name, which cannot point at the wrong lift.
 */
export const INFERRED_DEMOS: Record<string, string> = {
  // ---- chest
  barbell_bench_press: "https://www.youtube.com/watch?v=gRVjAtPip0Y",
  incline_barbell_press: "https://www.youtube.com/watch?v=O9x7xRhtA9Q",
  dumbbell_bench_press: "https://www.youtube.com/watch?v=xhEhjF5ozuY",
  incline_dumbbell_press: "https://www.youtube.com/watch?v=sK4Rvug6ufo",
  machine_chest_press: "https://www.youtube.com/watch?v=pLofEAcfsO8",
  smith_incline_press: "https://www.youtube.com/watch?v=yFQshytandQ",
  chest_dip: "https://www.youtube.com/watch?v=35y-0dQc3mE",
  pec_deck: "https://www.youtube.com/watch?v=hZ0CGRaKwbQ",
  cable_fly_high_low: "https://www.youtube.com/watch?v=8Um35Es-ROE",
  cable_fly_low_high: "https://www.youtube.com/watch?v=eQ_NBB6OBH4",
  dumbbell_fly: "https://www.youtube.com/watch?v=98aRvyw-IGg",
  push_up: "https://www.youtube.com/watch?v=mECzqUIDWfU",

  // ---- back
  conventional_deadlift: "https://www.youtube.com/watch?v=GxsLrTzyGUU",
  pull_up: "https://www.youtube.com/watch?v=1rRmIzEsl_4",
  chin_up: "https://www.youtube.com/watch?v=e1YSApl-QcM",
  lat_pulldown: "https://www.youtube.com/watch?v=CAwf7n6Luuc",
  neutral_grip_pulldown: "https://www.youtube.com/watch?v=4P3-TXbH4tw",
  barbell_row: "https://www.youtube.com/watch?v=rqTOAM8WoeM",
  pendlay_row: "https://www.youtube.com/watch?v=h4nkoayPFWw",
  dumbbell_row: "https://www.youtube.com/watch?v=pYcpY20QaE8",
  chest_supported_row: "https://www.youtube.com/watch?v=_b6ch2nIchk",
  seated_cable_row: "https://www.youtube.com/watch?v=EU7bOadUsNI",
  t_bar_row: "https://www.youtube.com/watch?v=SbZycT7Eq58",
  machine_row: "https://www.youtube.com/watch?v=QXy1bfxMae0",
  straight_arm_pulldown: "https://www.youtube.com/watch?v=duHQk2PxNos",

  // ---- traps
  barbell_shrug: "https://www.youtube.com/watch?v=q4x4syK-eXM",
  dumbbell_shrug: "https://www.youtube.com/watch?v=cJRVVxmytaM",

  // ---- shoulders
  overhead_press: "https://www.youtube.com/watch?v=2yjwXTZQDDI",
  dumbbell_shoulder_press: "https://www.youtube.com/watch?v=qEwKCR5JCog",
  machine_shoulder_press: "https://www.youtube.com/watch?v=3R14MnZbcpw",
  front_raise: "https://www.youtube.com/watch?v=DzF4olZiSBQ",
  dumbbell_lateral_raise: "https://www.youtube.com/watch?v=3VcKaXpzqRo",
  cable_lateral_raise: "https://www.youtube.com/watch?v=zpbm-xRHB6k",
  machine_lateral_raise: "https://www.youtube.com/watch?v=IropE3iOk2c",
  upright_row: "https://www.youtube.com/watch?v=amCU-ziHITM",
  reverse_pec_deck: "https://www.youtube.com/watch?v=v0rJuhEa59c",
  face_pull: "https://www.youtube.com/watch?v=eQaSpG7aMYQ",
  rear_delt_fly: "https://www.youtube.com/watch?v=dA4iqyTgx5I",

  // ---- biceps
  barbell_curl: "https://www.youtube.com/watch?v=JJB8XgKltA8",
  ez_bar_curl: "https://www.youtube.com/watch?v=5NsFLGUf0Fo",
  dumbbell_curl: "https://www.youtube.com/watch?v=sAq_ocpRh_I",
  incline_dumbbell_curl: "https://www.youtube.com/watch?v=1gCfaEWk_Ds",
  hammer_curl: "https://www.youtube.com/watch?v=zC3nLlEvin4",
  preacher_curl: "https://www.youtube.com/watch?v=e7X6G07KnPI",
  cable_curl: "https://www.youtube.com/watch?v=FTnvwZwLHb4",

  // ---- triceps
  close_grip_bench: "https://www.youtube.com/watch?v=cXbSJHtjrQQ",
  triceps_dip: "https://www.youtube.com/watch?v=85u_8mz5lBA",
  skull_crusher: "https://www.youtube.com/watch?v=RavQHfFxbdA",
  overhead_cable_extension: "https://www.youtube.com/watch?v=8WC7rIOkhi0",
  triceps_pushdown: "https://www.youtube.com/watch?v=_w-HpW70nSQ",
  dumbbell_kickback: "https://www.youtube.com/watch?v=6SS6K3lAwZ8",

  // ---- forearms
  wrist_curl: "https://www.youtube.com/watch?v=SqwIBiru46w",
  reverse_curl: "https://www.youtube.com/watch?v=pXx38ZWRYjo",

  // ---- quads
  back_squat: "https://www.youtube.com/watch?v=8PMjqgR8Wa8",
  front_squat: "https://www.youtube.com/watch?v=tCS4p5lS5rk",
  hack_squat: "https://www.youtube.com/watch?v=hglQExHCM9Q",
  leg_press: "https://www.youtube.com/watch?v=cDGOn-yfKJA",
  smith_squat: "https://www.youtube.com/watch?v=AHnX-aimA4E",
  bulgarian_split_squat: "https://www.youtube.com/watch?v=2C-uNgKwPLE",
  walking_lunge: "https://www.youtube.com/watch?v=I34ysEkPK7w",
  goblet_squat: "https://www.youtube.com/watch?v=6mf0oa2GGUc",
  leg_extension: "https://www.youtube.com/watch?v=4zOky6-n78I",

  // ---- hamstrings
  romanian_deadlift: "https://www.youtube.com/watch?v=lKLYvNGz6mk",
  stiff_leg_deadlift: "https://www.youtube.com/watch?v=1uDiW5--rAE",
  lying_leg_curl: "https://www.youtube.com/watch?v=3gZm9wGTsEo",
  seated_leg_curl: "https://www.youtube.com/watch?v=aakNLjjm4Qo",
  nordic_curl: "https://www.youtube.com/watch?v=kFSnvwvc5ac",
  good_morning: "https://www.youtube.com/watch?v=0Syp9iyINZ4",

  // ---- glutes
  hip_thrust: "https://www.youtube.com/watch?v=pF17m_CXfL0",
  sumo_deadlift: "https://www.youtube.com/watch?v=1ltxpKdXkG4",
  glute_bridge: "https://www.youtube.com/watch?v=Q_Bpj91Yiis",
  cable_kickback: "https://www.youtube.com/watch?v=bVrmtCI00Ys",
  hip_abduction: "https://www.youtube.com/watch?v=OQC8nso2aPE",

  // ---- calves
  standing_calf_raise: "https://www.youtube.com/watch?v=97NbelB5yvQ",
  seated_calf_raise: "https://www.youtube.com/watch?v=ORY-ke6vcgk",
  leg_press_calf_raise: "https://www.youtube.com/watch?v=8k435cj30gc",

  // ---- abs
  hanging_leg_raise: "https://www.youtube.com/watch?v=rbOJSK07AGA",
  cable_crunch: "https://www.youtube.com/watch?v=0KEP6A1deBE",
  decline_crunch: "https://www.youtube.com/watch?v=FRzQXeN1hro",
  ab_wheel: "https://www.youtube.com/watch?v=NbudTqiwguk",
  plank: "https://www.youtube.com/watch?v=mwlp75MS6Rg",
};

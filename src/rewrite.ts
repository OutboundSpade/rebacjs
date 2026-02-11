export type Rewrite =
  | { op: "sameObjectRelation"; relation: string }
  | { op: "followRelation"; through: string; relation: string }
  | { op: "union"; children: Rewrite[] }
  | { op: "intersection"; children: Rewrite[] }
  | { op: "difference"; base: Rewrite; subtract: Rewrite[] };

export const sameObjectRelation = (relation: string): Rewrite => ({
  op: "sameObjectRelation",
  relation,
});

export const followRelation = (cfg: {
  through: string;
  relation: string;
}): Rewrite => ({
  op: "followRelation",
  through: cfg.through,
  relation: cfg.relation,
});

export const union = (...children: Rewrite[]): Rewrite => ({
  op: "union",
  children,
});

export const intersection = (...children: Rewrite[]): Rewrite => ({
  op: "intersection",
  children,
});

export const difference = (base: Rewrite, ...subtract: Rewrite[]): Rewrite => ({
  op: "difference",
  base,
  subtract,
});

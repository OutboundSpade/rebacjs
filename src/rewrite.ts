export type Rewrite =
  | { op: "computedUserset"; relation: string }
  | { op: "tupleToUserset"; tupleRelation: string; computedRelation: string }
  | { op: "union"; children: Rewrite[] }
  | { op: "intersection"; children: Rewrite[] }
  | { op: "difference"; base: Rewrite; subtract: Rewrite[] };

export const computedUserset = (relation: string): Rewrite => ({
  op: "computedUserset",
  relation,
});

export const tupleToUserset = (
  tupleRelation: string,
  computedRelation: string,
): Rewrite => ({
  op: "tupleToUserset",
  tupleRelation,
  computedRelation,
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

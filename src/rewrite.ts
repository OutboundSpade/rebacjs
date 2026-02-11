/**
 * Rewrite expression used to define derived relations.
 * @example
 * const viewer = union(sameObjectRelation("owner"), sameObjectRelation("editor"));
 */
export type Rewrite =
  | { op: "sameObjectRelation"; relation: string }
  | { op: "followRelation"; through: string; relation: string }
  | { op: "union"; children: Rewrite[] }
  | { op: "intersection"; children: Rewrite[] }
  | { op: "difference"; base: Rewrite; subtract: Rewrite[] };

/**
 * Reuses another relation on the same object.
 * @example
 * const ownerViewer = sameObjectRelation("owner");
 */
export const sameObjectRelation = (relation: string): Rewrite => ({
  op: "sameObjectRelation",
  relation,
});

/**
 * Follows a relation to another object, then checks a relation there.
 * @example
 * const inherited = followRelation({ through: "parent", relation: "viewer" });
 */
export const followRelation = (cfg: {
  through: string;
  relation: string;
}): Rewrite => ({
  op: "followRelation",
  through: cfg.through,
  relation: cfg.relation,
});

/**
 * Returns true when any child rewrite is true.
 * @example
 * const viewer = union(sameObjectRelation("owner"), sameObjectRelation("editor"));
 */
export const union = (...children: Rewrite[]): Rewrite => ({
  op: "union",
  children,
});

/**
 * Returns true only when every child rewrite is true.
 * @example
 * const both = intersection(sameObjectRelation("owner"), sameObjectRelation("editor"));
 */
export const intersection = (...children: Rewrite[]): Rewrite => ({
  op: "intersection",
  children,
});

/**
 * Returns true for `base` minus any matching `subtract` rewrites.
 * @example
 * const visible = difference(sameObjectRelation("viewer"), sameObjectRelation("banned"));
 */
export const difference = (base: Rewrite, ...subtract: Rewrite[]): Rewrite => ({
  op: "difference",
  base,
  subtract,
});

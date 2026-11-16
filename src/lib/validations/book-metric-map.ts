import { z } from "zod";
import { isGoalMetric } from "@/features/goals/lib/config/goal-config";
import { UUID_REGEX } from "@/lib/validations/common";

/** The most Development book parameters one Assessment metric may map to. */
export const MAX_METRIC_PARAMETERS = 20;

/**
 * One Goal metric and the whole list of parameters that train it: the save
 * replaces the metric's pairs with this list. An empty list clears it.
 * `metricKey` is a string refined by `isGoalMetric`, since GOAL_METRICS is
 * not a tuple `z.enum` takes; the retired kick_power_kaiser is refused.
 */
export const metricMapSchema = z.object({
  metricKey: z.string().refine(isGoalMetric, "מדד לא תקין"),
  parameterIds: z
    .array(z.string().regex(UUID_REGEX, "מזהה פרמטר לא תקין"))
    .max(MAX_METRIC_PARAMETERS, `אפשר לבחור עד ${MAX_METRIC_PARAMETERS} פרמטרים למדד`)
    .refine((ids) => new Set(ids).size === ids.length, "פרמטר מופיע פעמיים"),
});

export type MetricMapInput = z.input<typeof metricMapSchema>;
